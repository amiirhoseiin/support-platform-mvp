import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { AgentMessageForm } from '@/components/agent/AgentMessageForm';
import { AiDraftMessageCard } from '@/components/agent/AiDraftMessageCard';
import { TicketStatusActions } from '@/components/agent/TicketStatusActions';
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
} from 'lucide-react';

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

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'enterprise':
        return <Badge variant="destructive">Enterprise VIP</Badge>;
      case 'substantial':
        return <Badge variant="warning">Substantial Tier</Badge>;
      default:
        return <Badge variant="outline">Small Tier</Badge>;
    }
  };

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

          <TicketStatusActions ticketId={ticket.id} currentStatus={ticket.status} />
        </div>

        {/* Ticket Header & Customer Profile Banner */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                {getTierBadge(ticket.customer?.tier)}
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
                    return (
                      <div
                        key={message.id}
                        className="rounded-xl border-2 border-amber-300/80 bg-amber-50/60 p-4 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-amber-200 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-600 text-white">
                              <Lock className="h-3 w-3" />
                            </div>
                            <span className="font-semibold text-amber-950">
                              {message.sender?.name || 'Staff Member'}
                            </span>
                            <Badge variant="warning" className="text-[10px] py-0 px-1.5 h-4">
                              INTERNAL NOTE
                            </Badge>
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

                  // Normal message (Customer or Staff)
                  const isStaff =
                    message.sender?.role === 'agent' || message.sender?.role === 'founder';

                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col rounded-xl border p-4 shadow-2xs transition-all ${
                        isStaff
                          ? 'border-emerald-200 bg-emerald-50/30 ml-4 sm:ml-8'
                          : 'border-zinc-200 bg-white mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                              isStaff
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-700 text-white'
                            }`}
                          >
                            {isStaff ? (
                              <ShieldCheck className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                          </div>
                          <span className="font-semibold text-zinc-900">
                            {message.sender?.name || 'Customer'}
                          </span>
                          {isStaff && (
                            <Badge variant="success" className="text-[10px] py-0 px-1.5 h-4">
                              Support Agent
                            </Badge>
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
              <AgentMessageForm ticketId={ticket.id} />
            </div>
          </div>

          {/* SLA & Audit Trail Sidebar (1 col) */}
          <div className="space-y-4">
            <Card className="border-zinc-200 shadow-sm">
              <CardHeader className="p-4 pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-zinc-500" />
                  <CardTitle className="text-sm font-semibold">Audit Trail & SLA</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {events.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No logged events yet.</p>
                ) : (
                  <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
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
