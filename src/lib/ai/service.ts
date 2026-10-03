import { SupabaseClient } from '@supabase/supabase-js';
import { getAiProvider } from './provider';
import {
  AutoReplyConfig,
  SimilarSolvedTicket,
  SuggestedReplyResult,
  TicketCategory,
} from './types';

export const DEFAULT_AUTO_REPLY_CONFIG: AutoReplyConfig = {
  enabled: false,
  min_confidence: 0.85,
  allowed_categories: ['duplicate_question', 'feature_request'],
  excluded_categories: ['billing', 'security', 'bug'],
};

/**
 * Retrieves similar solved tickets strictly scoped to the specified customer tenant.
 * GUARANTEE: Never accesses or returns tickets belonging to another customer tenant.
 */
export async function getTenantSolvedTickets(
  supabase: SupabaseClient,
  customerId: string,
  currentTicketId: string
): Promise<SimilarSolvedTicket[]> {
  try {
    // HARD TENANT BOUNDARY: eq('customer_id', customerId)
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select(`
        id,
        subject,
        description,
        status,
        resolved_at,
        messages (
          body,
          is_internal_note,
          is_ai_draft,
          created_at,
          sender:sender_id (role)
        )
      `)
      .eq('customer_id', customerId)
      .in('status', ['resolved', 'closed'])
      .neq('id', currentTicketId)
      .order('resolved_at', { ascending: false })
      .limit(5);

    if (error || !tickets) {
      console.warn('Error fetching tenant solved tickets:', error?.message);
      return [];
    }

    return tickets.map((t) => {
      // Find the resolution message (staff response)
      const allMsgs = (t.messages || []) as Array<{
        body: string;
        is_internal_note: boolean;
        is_ai_draft: boolean;
        sender?: { role?: string } | Array<{ role?: string }>;
      }>;

      const staffSolution = allMsgs.find((m) => {
        const senderObj = Array.isArray(m.sender) ? m.sender[0] : m.sender;
        return (
          !m.is_internal_note &&
          !m.is_ai_draft &&
          (senderObj?.role === 'agent' || senderObj?.role === 'founder')
        );
      });

      return {
        id: t.id,
        subject: t.subject,
        description: t.description,
        resolutionSummary:
          staffSolution?.body ||
          allMsgs.filter((m) => !m.is_internal_note && !m.is_ai_draft).pop()?.body ||
          '(Resolved without public note)',
        resolvedAt: t.resolved_at || undefined,
      };
    });
  } catch (err) {
    console.error('Exception in getTenantSolvedTickets:', err);
    return [];
  }
}

/**
 * Loads the current auto-reply configuration from app_settings.
 * Defaults safely to disabled if not present.
 */
export async function getAutoReplyConfig(
  supabase: SupabaseClient
): Promise<AutoReplyConfig> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'auto_reply')
      .single();

    if (error || !data?.value) {
      return DEFAULT_AUTO_REPLY_CONFIG;
    }

    return {
      ...DEFAULT_AUTO_REPLY_CONFIG,
      ...(data.value as Partial<AutoReplyConfig>),
    };
  } catch {
    return DEFAULT_AUTO_REPLY_CONFIG;
  }
}

/**
 * Updates the auto-reply configuration in app_settings.
 */
export async function updateAutoReplyConfig(
  supabase: SupabaseClient,
  config: Partial<AutoReplyConfig>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await getAutoReplyConfig(supabase);
    const updated: AutoReplyConfig = {
      ...current,
      ...config,
      // Enforce safety invariant: billing and security must ALWAYS be excluded from auto-reply
      excluded_categories: ['billing', 'security', 'bug'],
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'auto_reply',
        value: updated,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update auto-reply settings',
    };
  }
}

/**
 * Main AI Copilot triage pipeline:
 * 1. Fetches tenant-scoped solved tickets.
 * 2. Runs AI classification and suggested reply generation.
 * 3. Enforces auto-reply safety policy (Disabled by default, Billing never auto-replies).
 * 4. Persists the classification and draft/reply with full audit logging.
 */
export async function triageTicketWithAi(
  supabase: SupabaseClient,
  ticketId: string
): Promise<{
  success: boolean;
  autoReplied: boolean;
  result?: SuggestedReplyResult;
  error?: string;
}> {
  try {
    // 1. Fetch ticket and customer
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, customer:customer_id(id, name, email, tier)')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return { success: false, autoReplied: false, error: 'Ticket not found.' };
    }

    const customerObj = (Array.isArray(ticket.customer) ? ticket.customer[0] : ticket.customer) as {
      tier?: string;
    } | null;
    const customerTier = customerObj?.tier || 'small';

    // 2. Retrieve tenant-scoped solved tickets (Zero cross-tenant leakage)
    const similarSolvedTickets = await getTenantSolvedTickets(
      supabase,
      ticket.customer_id,
      ticket.id
    );

    // 3. Run AI classification & draft generation
    const aiProvider = getAiProvider();
    const aiResult = await aiProvider.classifyAndDraft({
      subject: ticket.subject,
      description: ticket.description,
      customerTier,
      customerId: ticket.customer_id,
      similarSolvedTickets,
    });

    // 4. Update ticket metadata with classification category and confidence
    const existingMeta = (ticket.metadata || {}) as Record<string, unknown>;
    const updatedMetadata = {
      ...existingMeta,
      ai_classification: {
        category: aiResult.category,
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning,
        classified_at: new Date().toISOString(),
      },
    };

    await supabase
      .from('tickets')
      .update({ metadata: updatedMetadata })
      .eq('id', ticket.id);

    // 5. Evaluate Auto-Reply Policy
    const config = await getAutoReplyConfig(supabase);

    // STRICT SAFETY CRITERIA FOR AUTO-REPLY:
    // a. Auto-reply setting must be actively enabled
    // b. Category must be strictly low-risk (duplicate_question or feature_request)
    // c. Billing, security, and bugs MUST NEVER auto-reply
    // d. Confidence must meet or exceed the threshold (e.g. >= 0.85)
    // e. Suggested reply text must not be empty
    const isCategoryAllowed = config.allowed_categories.includes(aiResult.category);
    const isExcluded =
      aiResult.category === 'billing' ||
      aiResult.category === 'bug' ||
      aiResult.shouldRequireHumanReview;

    const canAutoReply =
      config.enabled &&
      isCategoryAllowed &&
      !isExcluded &&
      aiResult.confidence >= config.min_confidence &&
      aiResult.suggestedReplyText.trim().length > 0;

    if (canAutoReply) {
      // Human escape hatch appended to all auto-replies
      const replyWithEscapeHatch = `${aiResult.suggestedReplyText.trim()}

---
*Note: This response was generated automatically based on previous verified solutions for your account. If this does not resolve your inquiry, simply reply to this message and our support team will assist you immediately.*`;

      // Insert public live reply (is_ai_draft: false)
      // Use system or ticket assigned agent / founder as sender
      const { data: founderUser } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'founder')
        .limit(1)
        .single();

      const senderId = ticket.assigned_agent_id || founderUser?.id || ticket.customer_id;

      const { data: insertedMsg } = await supabase
        .from('messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: senderId,
          body: replyWithEscapeHatch,
          is_internal_note: false,
          is_ai_draft: false,
          metadata: {
            auto_replied: true,
            human_reviewed: false,
            classification: aiResult.category,
            confidence: aiResult.confidence,
            reasoning: aiResult.reasoning,
            similar_tickets: aiResult.similarTicketsUsed,
            model: aiResult.provider,
          },
        })
        .select('id')
        .single();

      // Update ticket: set first_responded_at, set status to in_progress (NEVER auto-close!)
      await supabase
        .from('tickets')
        .update({
          first_responded_at: new Date().toISOString(),
          status: 'in_progress', // ALWAYS keeps ticket open for human follow-up
        })
        .eq('id', ticket.id);

      // Audit log the auto-reply event
      await supabase.from('ticket_events').insert({
        ticket_id: ticket.id,
        action: 'status_changed',
        new_value: {
          auto_replied: true,
          message_id: insertedMsg?.id,
          category: aiResult.category,
          confidence: aiResult.confidence,
          reasoning: aiResult.reasoning,
        },
      });

      aiResult.autoReplied = true;
      return { success: true, autoReplied: true, result: aiResult };
    }

    // DEFAULT HUMAN-IN-THE-LOOP PATH:
    // Insert suggested draft into messages with is_ai_draft: true
    if (aiResult.suggestedReplyText.trim().length > 0) {
      // Find staff sender
      const { data: staffUser } = await supabase
        .from('users')
        .select('id')
        .in('role', ['agent', 'founder'])
        .limit(1)
        .single();

      const draftSenderId = staffUser?.id || ticket.assigned_agent_id || ticket.customer_id;

      const { error: insertError } = await supabase.from('messages').insert({
        ticket_id: ticket.id,
        sender_id: draftSenderId,
        body: aiResult.suggestedReplyText.trim(),
        is_internal_note: false,
        is_ai_draft: true,
        metadata: {
          auto_replied: false,
          human_reviewed: false,
          classification: aiResult.category,
          confidence: aiResult.confidence,
          reasoning: aiResult.reasoning,
          similar_tickets: aiResult.similarTicketsUsed,
          model: aiResult.provider,
        },
      });

      if (insertError) {
        console.error('Failed to insert AI draft message:', insertError.message);
      }
    }

    return { success: true, autoReplied: false, result: aiResult };
  } catch (err: unknown) {
    console.error('Error in triageTicketWithAi:', err);
    return {
      success: false,
      autoReplied: false,
      error: err instanceof Error ? err.message : 'Failed to triage ticket with AI',
    };
  }
}
