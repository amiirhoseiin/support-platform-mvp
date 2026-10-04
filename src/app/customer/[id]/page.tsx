import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { CustomerMessageForm } from '@/components/customer/CustomerMessageForm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ticket, TicketMessage, UserProfile } from '@/types/database';
import { ArrowLeft, Clock, User, ShieldCheck, CheckCircle2, MessageSquare, Sparkles, Bot } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerTicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/customer/${id}`);
  }

  // Fetch current user's profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Fetch ticket details (RLS ensures user can only fetch their own ticket)
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single();

  if (ticketError || !ticket) {
    notFound();
  }

  // Fetch ticket messages, explicitly excluding internal notes and AI drafts
  const { data: messagesData } = await supabase
    .from('messages')
    .select('*, sender:sender_id(name, email, role)')
    .eq('ticket_id', id)
    .eq('is_internal_note', false)
    .eq('is_ai_draft', false)
    .order('created_at', { ascending: true });

  const messages: TicketMessage[] = messagesData || [];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar user={profile as UserProfile} />

      <main className="mx-auto max-w-4xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 flex-1">
        {/* Back Link */}
        <div>
          <Link
            href="/customer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to All Tickets
          </Link>
        </div>

        {/* Ticket Header */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-xs text-zinc-400 font-mono">#{ticket.id.slice(0, 8)}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 mt-2">
                {ticket.subject}
              </h1>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <span>
                {new Date(ticket.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Original Ticket Description */}
          <div className="mt-5 border-t border-zinc-100 pt-4">
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

        {/* Conversation Thread */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <MessageSquare className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Conversation Thread</h2>
            <span className="text-xs text-zinc-400 font-mono">
              ({messages.length} {messages.length === 1 ? 'reply' : 'replies'})
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
              No replies yet. Our support engineering team will post updates here soon.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isCurrentUser = message.sender_id === user.id;
                const isAutoReplied = Boolean(message.metadata?.auto_replied);
                const isStaff =
                  message.sender?.role === 'agent' ||
                  message.sender?.role === 'founder' ||
                  Boolean(message.metadata?.human_reviewed || isAutoReplied || message.metadata?.is_ai_assisted || (!isCurrentUser && !message.is_internal_note));
                const isAiAssisted = Boolean(
                  message.metadata?.is_ai_assisted ||
                  message.metadata?.human_reviewed ||
                  isAutoReplied
                );

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col rounded-xl border p-4 shadow-2xs transition-all ${
                      isCurrentUser
                        ? 'border-blue-100 bg-blue-50/30 ml-4 sm:ml-8'
                        : isAutoReplied
                        ? 'border-purple-200 bg-purple-50/20 mr-4 sm:mr-8'
                        : isStaff
                        ? 'border-emerald-100 bg-emerald-50/30 mr-4 sm:mr-8'
                        : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                            isCurrentUser
                              ? 'bg-blue-600 text-white'
                              : isAutoReplied
                              ? 'bg-purple-600 text-white shadow-xs'
                              : isStaff
                              ? 'bg-emerald-600 text-white'
                              : 'bg-zinc-700 text-white'
                          }`}
                        >
                          {isCurrentUser ? (
                            <User className="h-3 w-3" />
                          ) : isAutoReplied ? (
                            <Bot className="h-3 w-3" />
                          ) : isStaff ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                        </div>
                        <span className="font-semibold text-zinc-900">
                          {isCurrentUser
                            ? 'You'
                            : isAutoReplied
                            ? 'Reza (AI Support Assistant)'
                            : message.sender?.name || (isStaff ? 'Support Team' : 'User')}
                        </span>
                        {isAutoReplied ? (
                          <Badge variant="purple" className="text-[10px] py-0 px-1.5 h-4">
                            🤖 AI Assistant
                          </Badge>
                        ) : isStaff ? (
                          <Badge variant="success" className="text-[10px] py-0 px-1.5 h-4">
                            Support Team
                          </Badge>
                        ) : null}
                        {isAutoReplied ? (
                          <span className="inline-flex items-center gap-1 text-[10px] py-0.5 px-1.5 rounded-full font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            <Sparkles className="h-2.5 w-2.5 text-purple-600" />
                            Automated Instant Reply
                          </span>
                        ) : isAiAssisted && !isCurrentUser ? (
                          <span className="inline-flex items-center gap-1 text-[10px] py-0.5 px-1.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Sparkles className="h-2.5 w-2.5 text-indigo-600" />
                            AI-Assisted Reply
                          </span>
                        ) : null}
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
        </div>

        {/* Resolution Notice or Message Form */}
        {ticket.status === 'resolved' || ticket.status === 'closed' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>This ticket has been marked as resolved.</span>
            </div>
            <p className="text-xs text-emerald-700 mt-1">
              If you still experience issues or have follow-up questions, you can send a message below to reopen this thread.
            </p>
            <div className="mt-4">
              <CustomerMessageForm ticketId={ticket.id} />
            </div>
          </div>
        ) : (
          <CustomerMessageForm ticketId={ticket.id} />
        )}
      </main>
    </div>
  );
}

