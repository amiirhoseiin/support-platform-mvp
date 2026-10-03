import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ticket } from '@/types/database';
import { Crown, AlertTriangle, Clock, Activity } from 'lucide-react';

interface FounderMetricsHeaderProps {
  openTickets: Ticket[];
}

export function FounderMetricsHeader({ openTickets }: FounderMetricsHeaderProps) {
  const totalOpen = openTickets.length;

  // Find oldest waiting ticket
  let longestWaitFormatted = '0m';
  let oldestTicket: Ticket | null = null;

  if (openTickets.length > 0) {
    const sortedByAge = [...openTickets].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    oldestTicket = sortedByAge[0];

    const diffMs = Math.max(0, Date.now() - new Date(oldestTicket.created_at).getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      longestWaitFormatted = `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      longestWaitFormatted = `${hours}h ${totalMinutes % 60}m`;
    } else {
      longestWaitFormatted = `${totalMinutes}m`;
    }
  }

  // Count VIP (Enterprise/Substantial) tickets waiting
  const vipCount = openTickets.filter(
    (t) => t.customer?.tier === 'enterprise' || t.customer?.tier === 'substantial'
  ).length;

  return (
    <div className="rounded-2xl border border-purple-200 bg-linear-to-r from-purple-50/70 via-indigo-50/40 to-white p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-purple-100 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
            <Crown className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-zinc-900">
                Founder SLA Executive Overview
              </h2>
              <Badge variant="purple" className="text-[10px] py-0 px-1.5 h-4">
                Management SLA
              </Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Real-time response time health answering: &quot;Are we slow?&quot;
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-purple-700 bg-purple-100/60 px-3 py-1 rounded-full self-start sm:self-auto">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          <span>Live Queue Health</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
        <Card className="border-purple-100 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Total Open Tickets
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-zinc-900">{totalOpen}</span>
                <span className="text-xs text-zinc-400">awaiting resolution</span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Longest Wait Time
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-amber-600">{longestWaitFormatted}</span>
                {oldestTicket && (
                  <span className="text-xs text-zinc-500 truncate max-w-[110px]" title={oldestTicket.subject}>
                    ({oldestTicket.customer?.name || 'Customer'})
                  </span>
                )}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                VIP / Tiered At Risk
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-zinc-900">{vipCount}</span>
                <span className="text-xs text-zinc-400">Enterprise/Substantial</span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Crown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
