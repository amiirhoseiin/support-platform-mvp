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

  // Fetch all tickets with joined customer info
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

  // Sorting: Crucial requirement:
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

  const isResolvedView = filter === 'resolved';
  const displayTickets = isResolvedView ? resolvedTickets : sortedOpenTickets;

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

          <div className="flex items-center gap-2 bg-zinc-200/60 p-1 rounded-lg self-start sm:self-auto text-xs font-medium">
            <Link
              href="/agent"
              className={`px-3 py-1.5 rounded-md transition-all ${
                !isResolvedView
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Active Queue ({openAndInProgress.length})
            </Link>
            <Link
              href="/agent?filter=resolved"
              className={`px-3 py-1.5 rounded-md transition-all ${
                isResolvedView
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
                  {isResolvedView ? 'Resolved History' : 'Priority Queue'}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {isResolvedView
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
                  {isResolvedView ? 'No resolved tickets found' : 'Queue is all caught up!'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  {isResolvedView
                    ? 'No tickets have been resolved yet.'
                    : 'There are no open or in-progress tickets waiting for a response.'}
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
                      <th scope="col" className="px-6 py-3">Wait Time</th>
                      <th scope="col" className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {displayTickets.map((ticket, idx) => {
                      const isTopVip =
                        ticket.customer?.tier === 'enterprise' &&
                        ticket.status === 'open';

                      return (
                        <tr
                          key={ticket.id}
                          className={`transition-colors hover:bg-zinc-50/80 group ${
                            isTopVip ? 'bg-amber-50/30' : ''
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
      </main>
    </div>
  );
}
