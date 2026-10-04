import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { AgentMessageForm } from '@/components/agent/AgentMessageForm';
import { AiDraftMessageCard } from '@/components/agent/AiDraftMessageCard';
import { TicketStatusActions } from '@/components/agent/TicketStatusActions';
import { TicketAssigneeSelector } from '@/components/agent/TicketAssigneeSelector';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ticket, TicketMessage, TicketEvent, UserProfile } from '@/types/database';
import {
  ArrowLeft,
  Clock,
  User,
  ShieldCheck,
  Lock,
  Building2,
  CheckCircle2,
  History,
  MessageSquare,
  Sparkles,
  UserCheck,
  ExternalLink,
  Paperclip,
  FileText,
  Activity,
  Bot,
} from 'lucide-react';
import { SLA_TARGETS_MINUTES, formatMinutes } from '@/lib/sla';
import { CustomerTier } from '@/types/database';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentTicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/agent/${id}`);
  }

  // Fetch staff profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'agent' && profile.role !== 'founder')) {
    redirect('/login');
  }

  // Fetch ticket details with joined customer
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*, customer:customer_id(id, name, email, tier), assigned_agent:assigned_agent_id(id, name, email)')
    .eq('id', id)
    .single();

  if (ticketError || !ticket) {
    notFound();
  }

  // Fetch ALL messages (including internal notes and AI drafts)
  const { data: messagesData } = await supabase
    .from('messages')
    .select('*, sender:sender_id(id, name, email, role)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  const messages: TicketMessage[] = messagesData || [];

  // Fetch ticket events for SLA & audit trail visibility
  const { data: eventsData } = await supabase
    .from('ticket_events')
    .select('*, actor:actor_id(name, email, role)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: false });

  const events: TicketEvent[] = eventsData || [];

  // Fetch staff members for assignment
  const { data: staffMembersData } = await supabase
    .from('users')
    .select('id, name, email, role')
    .in('role', ['agent', 'founder'])
    .order('name', { ascending: true });

  const staffMembers = (staffMembersData || []) as {
    id: string;
    name: string;
    email: string;
    role: 'agent' | 'founder';
  }[];

  // Fetch previous tickets for the same customer (excluding current ticket)
  const { data: previousTicketsData } = await supabase
    .from('tickets')
    .select('id, subject, status, priority, created_at, resolved_at')
    .eq('customer_id', ticket.customer_id)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(5);

  const previousTickets = (previousTicketsData || []) as Ticket[];

  // Extract external URLs and attachments mentioned in ticket description and messages
  const allText = [ticket.description, ...messages.map((m) => m.body)].join(' ');
  const urlMatches = Array.from(new Set(allText.match(/https?:\/\/[^\s"'<>\)]+/gi) || []));

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'enterprise':
        return <Badge variant="destructive">Enterprise VIP</Badge>;
      case 'substantial':
        return <Badge variant="warning">Substantial Tier</Badge>;
    }
  };

  const getCategoryBadgeVariant = (cat?: string) => {
    switch (cat) {
      case 'billing':
        return 'destructive' as const;
      case 'duplicate_question':
        return 'warning' as const;
      case 'feature_request':
        return 'purple' as const;
      default:
        return 'default' as const;
    }
  };

  const latestAssignEvent = events.find((e) => e.action === 'assigned');
    const isAssignedByFounder =
      latestAssignEvent?.actor?.role === 'founder' ||
      Boolean((latestAssignEvent?.new_value as { assigned_by_founder?: boolean } | null)?.assigned_by_founder);
    const isAssignedToMe = ticket.assigned_agent_id === user.id;

    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        <Navbar user={profile as UserProfile} />

        <main className="mx-auto max-w-6xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 flex-1">
          {/* Navigation & Status bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Link
              href="/agent"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Unified Queue
            </Link>

            <div className="flex items-center gap-3 flex-wrap">
              <TicketAssigneeSelector
                ticketId={ticket.id}
                currentAssigneeId={ticket.assigned_agent_id}
                staffMembers={staffMembers}
                currentUserRole={profile.role}
                currentUserId={user.id}
              />
              <TicketStatusActions ticketId={ticket.id} currentStatus={ticket.status} />
            </div>
          </div>

          {/* Prominent notice if Founder assigned this ticket to the agent */}
          {isAssignedToMe && isAssignedByFounder && profile.role === 'agent' && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-3.5 shadow-2xs flex items-center justify-between gap-3 text-xs text-purple-900">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white font-bold text-xs shrink-0">
                  👑
                </div>
                <div>
                  <p className="font-bold text-purple-950">Direct Founder Assignment</p>
                  <p className="text-[11px] text-purple-800">
                    Founder Sarah assigned this ticket directly to you for follow-up.
                  </p>
                </div>
              </div>
              <Badge variant="purple" className="shrink-0 text-[10px]">
                Priority Attention
              </Badge>
            </div>
          )}

          {/* Prominent indicator if ticket is assigned to current user */}
          {isAssignedToMe && (!isAssignedByFounder || profile.role === 'founder') && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 shadow-2xs flex items-center gap-2 text-xs text-blue-900 font-medium">
              <UserCheck className="h-4 w-4 text-blue-600 shrink-0" />
              <span>You are the designated owner of this ticket.</span>
            </div>
          )}

        {/* Ticket Header & Customer Profile Banner */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                {getTierBadge(ticket.customer?.tier)}
                {(() => {
                  const aiClass = (ticket.metadata as { ai_classification?: { category?: string; confidence?: number } })?.ai_classification;
                  if (!aiClass?.category) return null;
                  return (
                    <Badge
                      variant={getCategoryBadgeVariant(aiClass.category)}
                      className="text-[10px] py-0 px-1.5 h-4 capitalize"
                    >
                      AI: {aiClass.category.replace('_', ' ')} ({Math.round((aiClass.confidence || 0.85) * 100)}%)
                    </Badge>
                  );
                })()}
                <span className="text-xs text-zinc-400 font-mono">#{ticket.id.slice(0, 8)}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">
                {ticket.subject}
              </h1>
            </div>

            {/* Customer Details Box */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 text-xs space-y-1.5 min-w-[240px]">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold">
                <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                <span>{ticket.customer?.name || 'Customer'}</span>
              </div>
              <p className="text-zinc-500 font-mono pl-5">{ticket.customer?.email}</p>
              <div className="pt-1 border-t border-zinc-200/60 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Created:</span>
                <span className="font-mono">
                  {new Date(ticket.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {ticket.first_responded_at && (
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>First Reply:</span>
                  <span className="font-mono text-emerald-700">
                    {new Date(ticket.first_responded_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60">
                <span>Assigned Agent:</span>
                <span className="font-semibold text-zinc-800">
                  {ticket.assigned_agent?.name || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* Initial Ticket Description */}
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 text-xs">
                <User className="h-3 w-3" />
              </div>
              <span className="text-xs font-semibold text-zinc-700">Initial Issue Description</span>
            </div>
            <div className="rounded-lg bg-zinc-50 p-4 border border-zinc-200/60 text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>
          </div>
        </div>

        {/* Main Workspace: Conversation Thread & Audit Trail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Thread (2 cols on large screen) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-semibold text-zinc-900">Conversation & Notes Thread</h2>
                <span className="text-xs text-zinc-400 font-mono">
                  ({messages.length} total)
                </span>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
                No messages yet. Use the reply box below or generate an AI draft.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  // Phase 4: AI Draft
                  if (message.is_ai_draft) {
                    return (
                      <AiDraftMessageCard
                        key={message.id}
                        draft={message}
                        ticketId={ticket.id}
                      />
                    );
                  }

                  // Staff Internal Note
                  if (message.is_internal_note) {
                    const meta = (message.metadata || {}) as { directed_to_id?: string; directed_to_name?: string };
                    const isSenderFounder = message.sender?.role === 'founder';
                    const isDirectedToViewer = meta.directed_to_id === user.id;

                    return (
                      <div
                        key={message.id}
                        className={`rounded-xl border-2 p-4 shadow-2xs space-y-2 ${
                          isDirectedToViewer
                            ? 'border-blue-400 bg-blue-50/50'
                            : 'border-amber-300/80 bg-amber-50/60'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-amber-200 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-600 text-white">
                              <Lock className="h-3 w-3" />
                            </div>
                            <span className="font-semibold text-amber-950">
                              {message.sender?.name || 'Staff Member'}
                            </span>
                            <Badge variant="warning" className="text-[10px] py-0 px-1.5 h-4">
                              INTERNAL NOTE
                            </Badge>
                            {isSenderFounder && (
                              <Badge variant="purple" className="text-[10px] py-0 px-1.5 h-4">
                                Founder
                              </Badge>
                            )}
                            {isDirectedToViewer && (
                              <Badge variant="default" className="text-[10px] py-0 px-1.5 h-4 bg-blue-600 text-white">
                                📌 Directed to You
                              </Badge>
                            )}
                            {meta.directed_to_name && !isDirectedToViewer && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-amber-900 border-amber-300 bg-amber-100/60">
                                🎯 For: {meta.directed_to_name}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-amber-700 font-mono">
                            {new Date(message.created_at).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-sm text-amber-950 whitespace-pre-wrap leading-relaxed">
                          {message.body}
                        </div>
                      </div>
                    );
                  }

                  // Normal message (Customer, Staff, or Automated AI)
                  const isAutoReplied = Boolean(message.metadata?.auto_replied);
                  const isStaff =
                    message.sender?.role === 'agent' || message.sender?.role === 'founder' || isAutoReplied;
                  const isAiAssisted = Boolean(
                    message.metadata?.is_ai_assisted ||
                    message.metadata?.human_reviewed ||
                    isAutoReplied
                  );

                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col rounded-xl border p-4 shadow-2xs transition-all ${
                        isAutoReplied
                          ? 'border-purple-200 bg-purple-50/20 ml-4 sm:ml-8'
                          : isStaff
                          ? 'border-emerald-200 bg-emerald-50/30 ml-4 sm:ml-8'
                          : 'border-zinc-200 bg-white mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                              isAutoReplied
                                ? 'bg-purple-600 text-white shadow-xs'
                                : isStaff
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-700 text-white'
                            }`}
                          >
                            {isAutoReplied ? (
                              <Bot className="h-3 w-3" />
                            ) : isStaff ? (
                              <ShieldCheck className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                          </div>
                          <span className="font-semibold text-zinc-900">
                            {isAutoReplied
                              ? 'Reza (AI Support Assistant)'
                              : message.sender?.name || (isStaff ? 'Support Agent' : 'Customer')}
                          </span>
                          {isAutoReplied ? (
                            <Badge variant="purple" className="text-[10px] py-0 px-1.5 h-4">
                              🤖 AI Assistant
                            </Badge>
                          ) : isStaff ? (
                            <Badge variant="success" className="text-[10px] py-0 px-1.5 h-4">
                              Support Agent
                            </Badge>
                          ) : null}
                          {isAiAssisted && (
                            <span className="inline-flex items-center gap-1 text-[10px] py-0.5 px-1.5 rounded-full font-medium bg-violet-100 text-violet-800 border border-violet-200">
                              <Sparkles className="h-2.5 w-2.5 text-violet-600" />
                              {message.metadata?.auto_replied
                                ? 'Automated Instant Reply'
                                : message.metadata?.was_edited_by_agent
                                ? 'AI Copilot (Edited & Approved)'
                                : 'AI Copilot (Approved)'}
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-zinc-400 font-mono">
                          {new Date(message.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                        {message.body}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Agent Message Form */}
            <div className="pt-2">
              <AgentMessageForm
                ticketId={ticket.id}
                staffMembers={staffMembers}
                currentUserId={user.id}
              />
            </div>
          </div>

          {/* Comprehensive Agent Context Sidebar (1 col) */}
          <div className="space-y-4">
            {/* 1. Customer Plan & Contract SLA Card */}
            <Card className="border-zinc-200 shadow-xs">
              <CardHeader className="p-3.5 pb-2 border-b border-zinc-100 bg-zinc-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                    <Building2 className="h-4 w-4 text-zinc-500" />
                    <span>Account & Contract SLA</span>
                  </div>
                  {getTierBadge(ticket.customer?.tier)}
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Plan Tier:</span>
                  <span className="font-semibold text-zinc-800 capitalize">{ticket.customer?.tier || 'small'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">First Reply SLA:</span>
                  <span className="font-mono font-bold text-purple-900">
                    &lt;{formatMinutes(SLA_TARGETS_MINUTES[(ticket.customer?.tier || 'small') as CustomerTier] || 1440)}
                  </span>
                </div>
                {ticket.customer?.metadata && Object.keys(ticket.customer.metadata).length > 0 && (
                  <div className="pt-2 border-t border-zinc-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Account Metadata</span>
                    {Object.entries(ticket.customer.metadata).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500 capitalize">{key.replace('_', ' ')}:</span>
                        <span className="font-mono text-zinc-800">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Customer Previous Tickets History (Without leaving screen) */}
            <Card className="border-zinc-200 shadow-xs">
              <CardHeader className="p-3.5 pb-2 border-b border-zinc-100 bg-zinc-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                    <History className="h-4 w-4 text-zinc-500" />
                    <span>Customer Ticket History</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {previousTickets.length} past
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 max-h-[220px] overflow-y-auto">
                {previousTickets.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-400 italic">
                    First ticket from this customer account.
                  </div>
                ) : (
                  previousTickets.map((pt) => (
                    <Link
                      key={pt.id}
                      href={`/agent/${pt.id}`}
                      className="block p-3 hover:bg-zinc-50 transition-colors text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-zinc-900 truncate max-w-[160px]" title={pt.subject}>
                          {pt.subject}
                        </span>
                        <StatusBadge status={pt.status} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                        <span>#{pt.id.slice(0, 8)}</span>
                        <span>{new Date(pt.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* 3. Attachments & External References Panel */}
            <Card className="border-zinc-200 shadow-xs">
              <CardHeader className="p-3.5 pb-2 border-b border-zinc-100 bg-zinc-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                    <Paperclip className="h-4 w-4 text-zinc-500" />
                    <span>Attachments & Resources</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {urlMatches.length} links
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 text-xs">
                {urlMatches.length === 0 ? (
                  <p className="text-zinc-400 text-xs italic">
                    No external URLs, logs, or file links attached to this thread.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {urlMatches.map((link, idx) => {
                      let domain = link;
                      try {
                        domain = new URL(link).hostname;
                      } catch {
                        domain = link.slice(0, 25);
                      }
                      return (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 p-2 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors text-[11px] text-blue-700 font-medium"
                        >
                          <span className="truncate">{domain}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. Audit Trail & SLA Event Stream */}
            <Card className="border-zinc-200 shadow-xs">
              <CardHeader className="p-3.5 pb-2 border-b border-zinc-100 bg-zinc-50/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                  <Activity className="h-4 w-4 text-zinc-500" />
                  <span>Audit Trail & SLA Events</span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {events.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No logged events yet.</p>
                ) : (
                  <div className="relative pl-4 space-y-3.5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
                    {events.map((evt) => (
                      <div key={evt.id} className="relative text-xs space-y-0.5">
                        <div className="absolute -left-4 top-1 h-2 w-2 rounded-full bg-zinc-400 ring-2 ring-white" />
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-800 capitalize">
                          <span>{evt.action.replace('_', ' ')}</span>
                          {evt.actor && (
                            <span className="text-[11px] font-normal text-zinc-500">
                              by {evt.actor.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          {new Date(evt.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
