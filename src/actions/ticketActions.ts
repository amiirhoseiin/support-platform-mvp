'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { TicketPriority, TicketStatus } from '@/types/database';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/**
 * Creates a new support ticket and logs the 'created' event in ticket_events.
 */
export async function createTicket(formData: FormData): Promise<ActionResult<{ ticketId: string }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    const subject = (formData.get('subject') as string)?.trim();
    const description = (formData.get('description') as string)?.trim();
    const priority = ((formData.get('priority') as string) || 'normal') as TicketPriority;

    if (!subject || subject.length === 0) {
      return { success: false, error: 'Subject is required.' };
    }

    if (!description || description.length === 0) {
      return { success: false, error: 'Description is required.' };
    }

    // 1. Insert into tickets table
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        customer_id: user.id,
        subject,
        description,
        priority,
        status: 'open',
      })
      .select('id, priority, subject')
      .single();

    if (ticketError || !ticket) {
      console.error('Failed to create ticket:', ticketError);
      return { success: false, error: ticketError?.message || 'Failed to create ticket.' };
    }

    // 2. Log 'created' event in ticket_events table
    const { error: eventError } = await supabase.from('ticket_events').insert({
      ticket_id: ticket.id,
      actor_id: user.id,
      action: 'created',
      new_value: {
        status: 'open',
        priority: ticket.priority,
        subject: ticket.subject,
      },
    });

    if (eventError) {
      console.error('Failed to log ticket event:', eventError);
    }

    revalidatePath('/customer');
    revalidatePath('/agent');

    return { success: true, data: { ticketId: ticket.id } };
  } catch (err: unknown) {
    console.error('Error in createTicket:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}

/**
 * Sends a message in a ticket thread.
 * Supports public messages and staff internal notes.
 */
export async function sendMessage(formData: FormData): Promise<ActionResult<{ messageId: string }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    const ticketId = (formData.get('ticketId') as string)?.trim();
    const body = (formData.get('body') as string)?.trim();
    const isInternalNote = formData.get('isInternalNote') === 'true';
    const targetStaffId = (formData.get('targetStaffId') as string)?.trim() || null;
    const targetStaffName = (formData.get('targetStaffName') as string)?.trim() || null;

    if (!ticketId) {
      return { success: false, error: 'Ticket ID is required.' };
    }

    if (!body || body.length === 0) {
      return { success: false, error: 'Message body cannot be empty.' };
    }

    const metadata: Record<string, unknown> = {};
    if (isInternalNote && targetStaffId) {
      metadata.directed_to_id = targetStaffId;
      metadata.directed_to_name = targetStaffName;
    }

    // 1. Insert message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        body,
        is_internal_note: isInternalNote,
        is_ai_draft: false,
        metadata,
      })
      .select('id')
      .single();

    if (messageError || !message) {
      console.error('Failed to insert message:', messageError);
      return { success: false, error: messageError?.message || 'Failed to send message.' };
    }

    // 2. If internal note was added by staff, record 'note_added' audit event
    if (isInternalNote) {
      await supabase.from('ticket_events').insert({
        ticket_id: ticketId,
        actor_id: user.id,
        action: 'note_added',
        new_value: {
          is_internal_note: true,
          directed_to_id: targetStaffId,
          directed_to_name: targetStaffName,
        },
      });
    }

    // 3. If staff replies publicly and first_responded_at is null, update first_responded_at and status
    if (!isInternalNote) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile && (profile.role === 'agent' || profile.role === 'founder')) {
        const { data: currentTicket } = await supabase
          .from('tickets')
          .select('first_responded_at, status')
          .eq('id', ticketId)
          .single();

        const updates: { first_responded_at?: string; status?: TicketStatus } = {};
        if (!currentTicket?.first_responded_at) {
          updates.first_responded_at = new Date().toISOString();
        }
        if (currentTicket?.status === 'open') {
          updates.status = 'in_progress';
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('tickets').update(updates).eq('id', ticketId);

          if (updates.status) {
            await supabase.from('ticket_events').insert({
              ticket_id: ticketId,
              actor_id: user.id,
              action: 'status_changed',
              old_value: { status: currentTicket?.status },
              new_value: { status: updates.status },
            });
          }
        }
      }
    }

    revalidatePath(`/customer/${ticketId}`);
    revalidatePath(`/agent/${ticketId}`);
    revalidatePath('/customer');
    revalidatePath('/agent');

    return { success: true, data: { messageId: message.id } };
  } catch (err: unknown) {
    console.error('Error in sendMessage:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}

/**
 * Updates a ticket status (e.g., resolved or in_progress) and records the event.
 */
export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Unauthorized.' };
    }

    // Fetch existing status
    const { data: currentTicket } = await supabase
      .from('tickets')
      .select('status')
      .eq('id', ticketId)
      .single();

    const updates: { status: TicketStatus; resolved_at?: string | null } = {
      status: newStatus,
    };

    if (newStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    } else {
      updates.resolved_at = null;
    }

    const { error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticketId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log event
    await supabase.from('ticket_events').insert({
      ticket_id: ticketId,
      actor_id: user.id,
      action: newStatus === 'resolved' ? 'resolved' : 'status_changed',
      old_value: { status: currentTicket?.status },
      new_value: { status: newStatus },
    });

    revalidatePath(`/customer/${ticketId}`);
    revalidatePath(`/agent/${ticketId}`);
    revalidatePath('/customer');
    revalidatePath('/agent');

    return { success: true };
  } catch (err: unknown) {
    console.error('Error updating status:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update ticket status.',
    };
  }
}

/**
 * Phase 4: Generates an AI draft reply using Vercel AI SDK and saves it to messages with is_ai_draft: true
 */
export async function generateAiDraft(ticketId: string): Promise<ActionResult<{ draftId: string; text: string }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' };
    }

    // Verify staff permissions
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'agent' && profile?.role !== 'founder') {
      return { success: false, error: 'Forbidden. Staff only.' };
    }

    // Fetch ticket details with customer
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('*, customer:customer_id(id, name, email, tier)')
      .eq('id', ticketId)
      .single();

    if (ticketErr || !ticket) {
      return { success: false, error: 'Ticket not found.' };
    }

    // Fetch previous thread messages (chronological order)
    const { data: messages } = await supabase
      .from('messages')
      .select('body, is_internal_note, is_ai_draft, sender:sender_id(name, role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    // Format context for prompt
    const customerObj = (Array.isArray(ticket.customer) ? ticket.customer[0] : ticket.customer) as { name?: string; email?: string; tier?: string } | null;
    const customerInfo = `Customer: ${customerObj?.name || 'Customer'} (${customerObj?.email || 'N/A'}), Tier: ${customerObj?.tier?.toUpperCase() || 'SMALL'}`;
    const threadContext = (messages || [])
      .filter((m) => !m.is_ai_draft) // omit existing drafts
      .map((m) => {
        const senderObj = (Array.isArray(m.sender) ? m.sender[0] : m.sender) as { name?: string; role?: string } | null;
        const roleLabel = m.is_internal_note
          ? '[INTERNAL NOTE]'
          : senderObj?.role === 'customer'
          ? '[CUSTOMER]'
          : '[SUPPORT AGENT]';
        return `${roleLabel} ${senderObj?.name || 'User'}: ${m.body}`;
      })
      .join('\n');

    const prompt = `
You are a senior technical support engineer at a B2B SaaS company.
Generate a polite, clear, empathetic, and professional draft response to assist the customer.

${customerInfo}
Ticket Subject: ${ticket.subject}
Ticket Description:
${ticket.description}

Conversation History so far:
${threadContext || '(No previous messages)'}

Guidelines:
1. Address the customer respectfully.
2. Acknowledge their issue directly and reassure them based on their tier.
3. If more technical diagnostics (logs, request IDs, timestamps) are needed, ask specific, helpful questions.
4. Match the language used by the customer (if the inquiry is in Persian, reply in polite, fluent Persian; if in English, reply in professional English).
5. Output ONLY the response body text to be sent to the customer. Do not include meta-commentary, placeholders like "[Your Name]", or markdown quotes.
`;

    const candidateModels = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-2.5-flash-lite'];
    let draftText = '';
    let usedModel = 'gemini-flash-latest';

    for (const m of candidateModels) {
      try {
        const result = await generateText({
          model: google(m),
          prompt,
        });
        if (result.text) {
          draftText = result.text.trim();
          usedModel = m;
          break;
        }
      } catch (genErr) {
        console.warn(`Model ${m} encountered demand/error, falling back:`, (genErr as Error)?.message);
      }
    }

    if (!draftText) {
      return { success: false, error: 'AI service is temporarily experiencing high demand. Please try again shortly.' };
    }

    // Insert draft into messages table with is_ai_draft: true
    const { data: draftMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        body: draftText,
        is_internal_note: false,
        is_ai_draft: true,
        metadata: {
          ai_model: usedModel,
          generated_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (insertError || !draftMessage) {
      console.error('Failed to insert AI draft message:', insertError);
      return { success: false, error: insertError?.message || 'Failed to save draft.' };
    }

    revalidatePath(`/agent/${ticketId}`);
    return { success: true, data: { draftId: draftMessage.id, text: draftText } };
  } catch (err: unknown) {
    console.error('Error generating AI draft:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate AI draft.',
    };
  }
}

/**
 * Phase 4: Approves an AI draft, making it a live customer-visible message
 * and updating first_responded_at if needed.
 */
export async function approveAndSendDraft(
  messageId: string,
  ticketId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Unauthorized.' };
    }

    // 1. Update message: clear is_ai_draft flag
    const { error: msgUpdateError } = await supabase
      .from('messages')
      .update({ is_ai_draft: false })
      .eq('id', messageId);

    if (msgUpdateError) {
      return { success: false, error: msgUpdateError.message };
    }

    // 2. Update ticket first_responded_at & status if needed
    const { data: ticket } = await supabase
      .from('tickets')
      .select('first_responded_at, status')
      .eq('id', ticketId)
      .single();

    const updates: { first_responded_at?: string; status?: TicketStatus } = {};
    if (!ticket?.first_responded_at) {
      updates.first_responded_at = new Date().toISOString();
    }
    if (ticket?.status === 'open') {
      updates.status = 'in_progress';
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('tickets').update(updates).eq('id', ticketId);

      if (updates.status) {
        await supabase.from('ticket_events').insert({
          ticket_id: ticketId,
          actor_id: user.id,
          action: 'status_changed',
          old_value: { status: ticket?.status },
          new_value: { status: updates.status },
        });
      }
    }

    revalidatePath(`/agent/${ticketId}`);
    revalidatePath(`/customer/${ticketId}`);
    revalidatePath('/agent');
    revalidatePath('/customer');

    return { success: true };
  } catch (err: unknown) {
    console.error('Error approving AI draft:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to approve draft.',
    };
  }
}

/**
 * Discards an unapproved AI draft message.
 */
export async function discardDraft(messageId: string, ticketId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('messages').delete().eq('id', messageId).eq('is_ai_draft', true);
    if (error) return { success: false, error: error.message };

    revalidatePath(`/agent/${ticketId}`);
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to discard draft.',
    };
  }
}

export interface StaffNotificationItem {
  id: string;
  type: 'internal_note' | 'assignment' | 'urgent_unassigned';
  title: string;
  description: string;
  ticketId: string;
  createdAt: string;
  isUrgent?: boolean;
}

/**
 * Assigns or reassigns a ticket to a staff member (or unassigns if null).
 * Records an immutable 'assigned' event in ticket_events.
 */
export async function assignTicket(
  ticketId: string,
  assignedAgentId: string | null
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'Unauthorized.' };
    }

    // Verify staff role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'agent' && profile?.role !== 'founder') {
      return { success: false, error: 'Forbidden. Staff only.' };
    }

    // Fetch existing assigned agent
    const { data: currentTicket } = await supabase
      .from('tickets')
      .select('assigned_agent_id')
      .eq('id', ticketId)
      .single();

    // PERMISSION ENFORCEMENT:
    // Every agent can just assign a ticket to themselves (or unassign their own ticket).
    // The founder can assign to anyone.
    if (profile.role === 'agent') {
      if (assignedAgentId !== null && assignedAgentId !== user.id) {
        return {
          success: false,
          error: 'Permission denied: Support agents can only claim tickets for themselves. Only the founder can assign tickets to other colleagues.',
        };
      }

      // If already assigned to someone else, an agent cannot unassign or take it over
      if (
        currentTicket?.assigned_agent_id &&
        currentTicket.assigned_agent_id !== user.id
      ) {
        return {
          success: false,
          error: 'This ticket is already owned by another colleague. Only the founder can reassign it.',
        };
      }
    }

    // Update ticket assigned_agent_id
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ assigned_agent_id: assignedAgentId })
      .eq('id', ticketId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Record 'assigned' event in ticket_events with founder attribution
    await supabase.from('ticket_events').insert({
      ticket_id: ticketId,
      actor_id: user.id,
      action: 'assigned',
      old_value: { assigned_agent_id: currentTicket?.assigned_agent_id },
      new_value: {
        assigned_agent_id: assignedAgentId,
        assigned_by_role: profile.role,
        assigned_by_founder: profile.role === 'founder',
      },
    });

    revalidatePath(`/agent/${ticketId}`);
    revalidatePath('/agent');

    return { success: true };
  } catch (err: unknown) {
    console.error('Error assigning ticket:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to assign ticket.',
    };
  }
}

/**
 * Fetches relevant alerts for staff:
 * 1. Internal notes by colleagues (especially mentions or urgent notes)
 * 2. Tickets assigned to the current user
 * 3. High-priority unassigned tickets
 */
export async function getStaffNotifications(): Promise<StaffNotificationItem[]> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return [];

    const { data: profile } = await supabase
      .from('users')
      .select('name, role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'agent' && profile?.role !== 'founder') return [];

    const isFounder = profile.role === 'founder';
    const items: StaffNotificationItem[] = [];

    // 1. Internal notes by other colleagues
    // Founder: sees all internal notes across all tickets.
    // Agent: ONLY sees notes for tickets they own, notes directed to them, or unassigned pool notes.
    const { data: internalNotes } = await supabase
      .from('messages')
      .select('id, ticket_id, body, created_at, metadata, sender:sender_id(id, name, role), ticket:ticket_id(subject, assigned_agent_id)')
      .eq('is_internal_note', true)
      .neq('sender_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12);

    if (internalNotes) {
      internalNotes.forEach((n) => {
        const senderObj = (Array.isArray(n.sender) ? n.sender[0] : n.sender) as { id?: string; name?: string; role?: string } | null;
        const ticketObj = (Array.isArray(n.ticket) ? n.ticket[0] : n.ticket) as { subject?: string; assigned_agent_id?: string | null } | null;
        const meta = (n.metadata || {}) as { directed_to_id?: string; directed_to_name?: string };

        // PERMISSION & SCOPING FILTER:
        // Founder has executive access to all company notes.
        // Agent only receives notes for tickets they own, directed to them, or unassigned queue.
        // Agent does NOT receive notifications for notes founder/agents wrote for other agents' tickets!
        if (!isFounder) {
          const isAssignedToMe = ticketObj?.assigned_agent_id === user.id;
          const isDirectedToMe = meta.directed_to_id === user.id;
          const isUnassignedPool = !ticketObj?.assigned_agent_id;
          const isMentioned = profile.name && n.body.toLowerCase().includes(profile.name.toLowerCase().split(' ')[0]);

          if (!isAssignedToMe && !isDirectedToMe && !isUnassignedPool && !isMentioned) {
            return; // Skip note from other agent's ticket
          }
        }

        const isDirectedToMe = meta.directed_to_id === user.id;
        const isFromFounder = senderObj?.role === 'founder';
        const isMention =
          profile.name &&
          n.body.toLowerCase().includes(profile.name.toLowerCase().split(' ')[0]);
        const isUrgent = n.body.toLowerCase().includes('urgent') || Boolean(isMention) || Boolean(isDirectedToMe);

        let noteTitle = `${senderObj?.name || 'Colleague'} left an internal note`;
        if (isDirectedToMe) {
          noteTitle = `🎯 ${senderObj?.name || 'Colleague'} left a note for YOU`;
        } else if (isFromFounder && !isFounder) {
          noteTitle = `👑 Founder note on your ticket`;
        }

        items.push({
          id: `note-${n.id}`,
          type: 'internal_note',
          title: noteTitle,
          description: `"${n.body.length > 90 ? n.body.slice(0, 90) + '...' : n.body}" on ${ticketObj?.subject || 'Ticket'}`,
          ticketId: n.ticket_id,
          createdAt: n.created_at,
          isUrgent,
        });
      });
    }

    // 2. Open tickets assigned to current user
    const { data: myTickets } = await supabase
      .from('tickets')
      .select('id, subject, priority, created_at, customer:customer_id(name, tier)')
      .eq('assigned_agent_id', user.id)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(6);

    if (myTickets && myTickets.length > 0) {
      // Check which tickets were assigned by the founder
      const ticketIds = myTickets.map((t) => t.id);
      const { data: assignEvents } = await supabase
        .from('ticket_events')
        .select('ticket_id, new_value, actor:actor_id(name, role)')
        .in('ticket_id', ticketIds)
        .eq('action', 'assigned')
        .order('created_at', { ascending: false });

      const founderAssignedTicketIds = new Set<string>();
      if (assignEvents) {
        assignEvents.forEach((evt) => {
          const actorObj = (Array.isArray(evt.actor) ? evt.actor[0] : evt.actor) as { role?: string; name?: string } | null;
          const newVal = (evt.new_value || {}) as { assigned_by_founder?: boolean };
          if (actorObj?.role === 'founder' || newVal.assigned_by_founder) {
            founderAssignedTicketIds.add(evt.ticket_id);
          }
        });
      }

      myTickets.forEach((t) => {
        const customerObj = (Array.isArray(t.customer) ? t.customer[0] : t.customer) as { name?: string; tier?: string } | null;
        const isFromFounder = founderAssignedTicketIds.has(t.id);

        items.push({
          id: `assigned-${t.id}`,
          type: 'assignment',
          title: isFromFounder
            ? `👑 Founder Sarah assigned you a ticket!`
            : `Assigned to You: ${t.subject}`,
          description: isFromFounder
            ? `Direct founder assignment for ${customerObj?.name || 'Client'} (${customerObj?.tier?.toUpperCase()} Tier). Priority action requested.`
            : `Customer: ${customerObj?.name || 'Client'} (${customerObj?.tier?.toUpperCase() || 'NORMAL'} Tier) • Priority: ${t.priority}`,
          ticketId: t.id,
          createdAt: t.created_at,
          isUrgent: isFromFounder || t.priority === 'critical',
        });
      });
    }

    // 3. Unassigned open tickets (SLA danger)
    const { data: unassignedTickets } = await supabase
      .from('tickets')
      .select('id, subject, priority, created_at, customer:customer_id(name, tier)')
      .is('assigned_agent_id', null)
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(3);

    if (unassignedTickets) {
      unassignedTickets.forEach((t) => {
        const customerObj = (Array.isArray(t.customer) ? t.customer[0] : t.customer) as { name?: string; tier?: string } | null;
        items.push({
          id: `unassigned-${t.id}`,
          type: 'urgent_unassigned',
          title: `Unassigned Ticket Needs Owner`,
          description: `${t.subject} (${customerObj?.name || 'Customer'}, ${customerObj?.tier?.toUpperCase()} Tier)`,
          ticketId: t.id,
          createdAt: t.created_at,
          isUrgent: customerObj?.tier === 'enterprise' || t.priority === 'critical',
        });
      });
    }

    // Sort: urgent first, then newest
    return items.sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (err: unknown) {
    console.error('Error fetching staff notifications:', err);
    return [];
  }
}

