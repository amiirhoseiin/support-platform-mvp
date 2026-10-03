import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { Navbar } from '@/components/Navbar';
import { FounderMetricsHeader } from '@/components/agent/FounderMetricsHeader';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, UserProfile } from '@/types/database';
import {
  Inbox,
  Clock,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  UserCheck,
  UserX,
  Lock,
  Activity,
  MessageSquare,
} from 'lucide-react';

export default async function AgentQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/agent');
  }

  // Fetch agent profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'agent' && profile.role !== 'founder')) {
    redirect('/login');
  }

  // Fetch all tickets with joined customer info and assigned agent
  const { data: allTicketsData } = await supabase
    .from('tickets')
    .select('*, customer:customer_id(id, name, email, tier), assigned_agent:assigned_agent_id(id, name, email)')
    .order('created_at', { ascending: true });

  const allTickets: Ticket[] = allTicketsData || [];

  // Filter open & in_progress for the active queue
  const openAndInProgress = allTickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  );
  const resolvedTickets = allTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );

  // Sorting requirement:
  // Order by priority/tier first (enterprise/substantial first), then by oldest created_at (longest waiting)
  const tierWeights: Record<string, number> = {
    enterprise: 300,
    substantial: 200,
    small: 100,
  };

  const priorityWeights: Record<string, number> = {
    critical: 40,
    high: 30,
    normal: 20,
    low: 10,
  };

  const sortedOpenTickets = [...openAndInProgress].sort((a, b) => {
    // 1. Tier first (Enterprise / Substantial first)
    const tierA = tierWeights[a.customer?.tier || 'small'] || 0;
    const tierB = tierWeights[b.customer?.tier || 'small'] || 0;
    if (tierB !== tierA) {
      return tierB - tierA;
    }

    // 2. Priority
    const prioA = priorityWeights[a.priority] || 0;
    const prioB = priorityWeights[b.priority] || 0;
    if (prioB !== prioA) {
      return prioB - prioA;
    }

    // 3. Oldest created_at first (longest waiting)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const assignedToMe = sortedOpenTickets.filter((t) => t.assigned_agent_id === user.id);
  const unassignedTickets = sortedOpenTickets.filter((t) => !t.assigned_agent_id);

  let displayTickets: Ticket[] = sortedOpenTickets;
  if (filter === 'assigned_me') {
    displayTickets = assignedToMe;
  } else if (filter === 'unassigned') {
    displayTickets = unassignedTickets;
  } else if (filter === 'resolved') {
    displayTickets = resolvedTickets;
  }

  const isFounder = profile.role === 'founder';

  // Fetch recent internal notes with ticket and metadata
  const { data: recentInternalNotesData } = await supabase
    .from('messages')
    .select('id, ticket_id, body, created_at, metadata, sender:sender_id(id, name, role), ticket:ticket_id(subject, assigned_agent_id)')
    .eq('is_internal_note', true)
    .order('created_at', { ascending: false })
    .limit(20);

  // Filter notes based on role & permissions:
  // - Founder: executive access to all internal notes across all tickets.
  // - Agent: ONLY sees notes for tickets they own, unassigned tickets, or notes directed to them.
  // Notes on tickets assigned to another agent are filtered out.
  const allInternalNotes = recentInternalNotesData || [];
  const recentInternalNotes = isFounder
    ? allInternalNotes.slice(0, 5)
    : allInternalNotes
        .filter((note) => {
          const ticketObj = (Array.isArray(note.ticket) ? note.ticket[0] : note.ticket) as { assigned_agent_id?: string | null } | null;
          const meta = (note.metadata || {}) as { directed_to_id?: string };
          const isAssignedToMe = ticketObj?.assigned_agent_id === user.id;
          const isDirectedToMe = meta.directed_to_id === user.id;
          const isUnassignedPool = !ticketObj?.assigned_agent_id;
          const isMentioned =
            profile.name &&
            note.body.toLowerCase().includes(profile.name.toLowerCase().split(' ')[0]);

          return isAssignedToMe || isDirectedToMe || isUnassignedPool || isMentioned;
        })
        .slice(0, 5);

  // Fetch recent team audit events
  const { data: recentEventsData } = await supabase
    .from('ticket_events')
    .select('id, ticket_id, action, created_at, old_value, new_value, actor:actor_id(name, role), ticket:ticket_id(subject, assigned_agent_id)')
    .order('created_at', { ascending: false })
    .limit(20);

  const allEvents = recentEventsData || [];
  const recentEvents = isFounder
    ? allEvents.slice(0, 6)
    : allEvents
        .filter((evt) => {
          const ticketObj = (Array.isArray(evt.ticket) ? evt.ticket[0] : evt.ticket) as { assigned_agent_id?: string | null } | null;
          const isAssignedToMe = ticketObj?.assigned_agent_id === user.id;
          const isUnassignedPool = !ticketObj?.assigned_agent_id;
          return isAssignedToMe || isUnassignedPool;
        })
        .slice(0, 6);

  // Fetch tickets that were assigned by the founder for prominent badge notice
  const { data: founderAssignEvents } = await supabase
    .from('ticket_events')
    .select('ticket_id, new_value, actor:actor_id(role)')
    .eq('action', 'assigned');

  const founderAssignedMap = new Set<string>();
  if (founderAssignEvents) {
    founderAssignEvents.forEach((evt) => {
      const actorObj = (Array.isArray(evt.actor) ? evt.actor[0] : evt.actor) as { role?: string } | null;
      const newVal = (evt.new_value || {}) as { assigned_by_founder?: boolean };
      if (actorObj?.role === 'founder' || newVal.assigned_by_founder) {
        founderAssignedMap.add(evt.ticket_id);
      }
    });
  }

  const formatWaitTime = (createdAt: string) => {
    const diffMs = Math.max(0, Date.now() - new Date(createdAt).getTime());
    const mins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h waiting`;
    if (hours > 0) return `${hours}h ${mins % 60}m waiting`;
    return `${mins}m waiting`;
  };

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'enterprise':
        return <Badge variant="destructive">Enterprise VIP</Badge>;
      case 'substantial':
        return <Badge variant="warning">Substantial</Badge>;
      default:
        return <Badge variant="outline">Small</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar user={profile as UserProfile} />

      <main className="mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 flex-1">
        {/* Founder Metric SLA Header (Rendered conditionally when user role is 'founder') */}
        {profile.role === 'founder' && (
          <FounderMetricsHeader openTickets={openAndInProgress} />
        )}

        {/* Queue Header & Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Unified Support Queue
              </h1>
              <Badge variant="default" className="text-xs">
                {openAndInProgress.length} Active
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Prioritized by customer contract tier (Enterprise / Substantial) and longest wait time.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-200/70 p-1 rounded-lg text-xs font-medium">
            <Link
              href="/agent"
              className={`px-3 py-1.5 rounded-md transition-all ${
                !filter || filter === 'all'
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All Active ({openAndInProgress.length})
            </Link>
            <Link
              href="/agent?filter=assigned_me"
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter === 'assigned_me'
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Assigned to Me ({assignedToMe.length})
            </Link>
            <Link
              href="/agent?filter=unassigned"
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter === 'unassigned'
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Unassigned ({unassignedTickets.length})
            </Link>
            <Link
              href="/agent?filter=resolved"
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter === 'resolved'
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Resolved ({resolvedTickets.length})
            </Link>
          </div>
        </div>

        {/* Tickets Queue Table */}
        <Card className="border-zinc-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-zinc-100 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {filter === 'resolved'
                    ? 'Resolved History'
                    : filter === 'assigned_me'
                    ? 'My Assigned Tickets'
                    : filter === 'unassigned'
                    ? 'Unassigned Queue (Needs Owner)'
                    : 'Priority Queue'}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {filter === 'resolved'
                    ? 'Closed and resolved support threads'
                    : 'Ordered by tier weighting and SLA response urgency'}
                </CardDescription>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {displayTickets.length} items
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {displayTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  {filter === 'resolved'
                    ? 'No resolved tickets found'
                    : filter === 'assigned_me'
                    ? 'No tickets currently assigned to you'
                    : filter === 'unassigned'
                    ? 'No unassigned tickets - team has everything covered!'
                    : 'Queue is all caught up!'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  {filter === 'resolved'
                    ? 'No tickets have been resolved yet.'
                    : 'Great job maintaining responsiveness for our customers.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50/75 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th scope="col" className="px-6 py-3">Customer & Tier</th>
                      <th scope="col" className="px-6 py-3">Subject & Issue</th>
                      <th scope="col" className="px-6 py-3">Priority</th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3">Assignee</th>
                      <th scope="col" className="px-6 py-3">Wait Time</th>
                      <th scope="col" className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {displayTickets.map((ticket) => {
                      const isTopVip =
                        ticket.customer?.tier === 'enterprise' &&
                        ticket.status === 'open';
                      const isMyTicket = ticket.assigned_agent_id === user.id;
                      const isAssignedByFounder = founderAssignedMap.has(ticket.id);

                      return (
                        <tr
                          key={ticket.id}
                          className={`transition-colors group ${
                            isMyTicket
                              ? 'bg-blue-50/70 hover:bg-blue-100/70 border-l-4 border-l-blue-600'
                              : isTopVip
                              ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-500'
                              : 'hover:bg-zinc-50/80'
                          }`}
                        >
                          {/* Customer & Tier */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-900 text-sm">
                                  {ticket.customer?.name || 'Customer'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {getTierBadge(ticket.customer?.tier)}
                              </div>
                              <p className="text-[11px] text-zinc-400 font-mono">
                                {ticket.customer?.email}
                              </p>
                            </div>
                          </td>

                          {/* Subject & Description */}
                          <td className="px-6 py-4 max-w-md">
                            <Link
                              href={`/agent/${ticket.id}`}
                              className="block group-hover:text-blue-600 transition-colors"
                            >
                              <span className="font-semibold text-sm text-zinc-900 block truncate">
                                {ticket.subject}
                              </span>
                              <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                                {ticket.description}
                              </p>
                            </Link>
                          </td>

                          {/* Priority */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <PriorityBadge priority={ticket.priority} />
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={ticket.status} />
                          </td>

                          {/* Assignee */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isMyTicket ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-2xs">
                                  <UserCheck className="h-3 w-3" />
                                  Assigned to You
                                </span>
                                {isAssignedByFounder && profile.role === 'agent' && (
                                  <span className="inline-flex items-center rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800 border border-purple-200">
                                    👑 By Founder
                                  </span>
                                )}
                              </div>
                            ) : ticket.assigned_agent ? (
                              <div className="flex items-center gap-1.5 text-xs text-zinc-800 font-medium">
                                <div className="h-2 w-2 rounded-full bg-zinc-400" />
                                <span>{ticket.assigned_agent.name}</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Wait Time */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              <span
                                className={`font-mono ${
                                  ticket.customer?.tier === 'enterprise'
                                    ? 'text-red-700 font-semibold'
                                    : 'text-zinc-600'
                                }`}
                              >
                                {formatWaitTime(ticket.created_at)}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-400 block mt-0.5 font-mono">
                              {ticket.first_responded_at ? 'First replied' : 'Needs first reply'}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Link href={`/agent/${ticket.id}`}>
                              <Button
                                size="sm"
                                variant={isTopVip ? 'default' : 'outline'}
                                className="h-8 gap-1 text-xs"
                              >
                                View Ticket
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Staff Activity & Internal Notes Dashboard Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Recent Internal Notes Panel */}
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader className="p-4 pb-3 border-b border-zinc-100 bg-amber-50/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-600 text-white">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-zinc-900">
                      {isFounder ? 'Company-Wide Internal Notes' : 'Your Relevant Internal Notes'}
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      {isFounder
                        ? 'Executive view across all tickets and staff'
                        : 'Notes on your assigned tickets, mentions & shared queue'}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={isFounder ? 'purple' : 'warning'} className="text-[10px]">
                  {isFounder ? 'Founder View' : 'Your Scope'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
              {recentInternalNotes.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  {isFounder
                    ? 'No internal notes recorded yet.'
                    : 'No internal notes on your tickets or addressed to you.'}
                </div>
              ) : (
                recentInternalNotes.map((note) => {
                  const senderObj = (Array.isArray(note.sender) ? note.sender[0] : note.sender) as { name?: string; role?: string } | null;
                  const ticketObj = (Array.isArray(note.ticket) ? note.ticket[0] : note.ticket) as { subject?: string } | null;
                  const meta = (note.metadata || {}) as { directed_to_id?: string; directed_to_name?: string };
                  const isDirectedToMe = meta.directed_to_id === user.id;
                  const isFromFounder = senderObj?.role === 'founder';

                  return (
                    <Link
                      key={note.id}
                      href={`/agent/${note.ticket_id}`}
                      className="block p-3.5 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-zinc-900">
                            {senderObj?.name || 'Staff Member'}
                          </span>
                          {isFromFounder && (
                            <Badge variant="purple" className="text-[9px] py-0 px-1 h-3.5">
                              Founder
                            </Badge>
                          )}
                          {isDirectedToMe && (
                            <Badge variant="default" className="text-[9px] py-0 px-1 h-3.5 bg-blue-600">
                              For You
                            </Badge>
                          )}
                          {meta.directed_to_name && !isDirectedToMe && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 h-3.5 text-amber-900 border-amber-300">
                              For: {meta.directed_to_name}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(note.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-amber-900 mt-1 font-medium line-clamp-2 bg-amber-50/70 p-2 rounded border border-amber-200/50">
                        &ldquo;{note.body}&rdquo;
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1.5 truncate">
                        On ticket: <span className="font-medium text-zinc-700">{ticketObj?.subject || 'Ticket'}</span>
                      </p>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Recent Team Audit & Handoffs Activity */}
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader className="p-4 pb-3 border-b border-zinc-100 bg-zinc-50/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-700 text-white">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-zinc-900">
                      {isFounder ? 'Team Activity & Handoff Log' : 'Your Activity & Handoff Stream'}
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      {isFounder
                        ? 'Ticket assignments, status escalations and SLA events across company'
                        : 'Handoffs and status events on your tickets & shared queue'}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {isFounder ? 'Full Audit' : 'Your Scope'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  {isFounder ? 'No recent audit activity.' : 'No recent activity on your tickets.'}
                </div>
              ) : (
                recentEvents.map((evt) => {
                  const actorObj = (Array.isArray(evt.actor) ? evt.actor[0] : evt.actor) as { name?: string } | null;
                  const ticketObj = (Array.isArray(evt.ticket) ? evt.ticket[0] : evt.ticket) as { subject?: string } | null;

                  return (
                    <Link
                      key={evt.id}
                      href={`/agent/${evt.ticket_id}`}
                      className="block p-3.5 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 capitalize">
                          <span>{evt.action.replace('_', ' ')}</span>
                          {actorObj?.name && (
                            <span className="text-[11px] font-normal text-zinc-500">
                              by {actorObj.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(evt.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1 truncate">
                        Ticket: <span className="font-medium text-zinc-700">{ticketObj?.subject || 'Ticket'}</span>
                      </p>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
