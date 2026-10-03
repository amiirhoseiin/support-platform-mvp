'use client';

import * as React from 'react';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, CustomerTier, TicketPriority } from '@/types/database';
import {
  formatMinutes,
  getTicketResponseTimeMinutes,
  getTicketResolutionTimeMinutes,
  isTicketSlaBreached,
  isTicketStale,
  SLA_TARGETS_MINUTES,
} from '@/lib/sla';
import {
  Crown,
  AlertTriangle,
  Clock,
  Activity,
  CheckCircle2,
  TrendingDown,
  Layers,
  Search,
  ShieldCheck,
  XCircle,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface FounderMetricsHeaderProps {
  allTickets: Ticket[];
}

export function FounderMetricsHeader({ allTickets }: FounderMetricsHeaderProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showDetailedBreakdowns, setShowDetailedBreakdowns] = useState<boolean>(false);

  // 1. Filter active vs resolved
  const activeTickets = allTickets.filter(
    (t) => t.status !== 'resolved' && t.status !== 'closed'
  );
  const resolvedTickets = allTickets.filter(
    (t) => t.status === 'resolved' || t.status === 'closed'
  );

  // 2. First Response Time Calculations
  const respondedTickets = allTickets.filter((t) => Boolean(t.first_responded_at));
  const totalResponseTimeMinutes = respondedTickets.reduce(
    (acc, t) => acc + (getTicketResponseTimeMinutes(t) || 0),
    0
  );
  const avgResponseTimeMinutes =
    respondedTickets.length > 0 ? Math.round(totalResponseTimeMinutes / respondedTickets.length) : 0;

  // 3. Resolution Time Calculations
  const fullyResolvedTickets = allTickets.filter((t) => Boolean(t.resolved_at));
  const totalResolutionTimeMinutes = fullyResolvedTickets.reduce(
    (acc, t) => acc + (getTicketResolutionTimeMinutes(t) || 0),
    0
  );
  const avgResolutionTimeMinutes =
    fullyResolvedTickets.length > 0
      ? Math.round(totalResolutionTimeMinutes / fullyResolvedTickets.length)
      : 0;

  // 4. Backlog and SLA Breaches
  const breachedTickets = allTickets.filter((t) => isTicketSlaBreached(t));
  const staleTickets = activeTickets.filter((t) => isTicketStale(t, 24));
  const waitingCustomerCount = activeTickets.filter((t) => t.status === 'waiting_customer').length;
  const waitingInternalCount = activeTickets.filter((t) => t.status === 'waiting_internal').length;
  const reopenedCount = activeTickets.filter((t) => t.status === 'reopened').length;

  // 5. Breakdowns by Plan
  const planTiers: CustomerTier[] = ['enterprise', 'substantial', 'small'];
  const planStats = planTiers.map((tier) => {
    const tierTickets = allTickets.filter((t) => (t.customer?.tier || 'small') === tier);
    const tierResponded = tierTickets.filter((t) => Boolean(t.first_responded_at));
    const tierTotalResp = tierResponded.reduce((acc, t) => acc + (getTicketResponseTimeMinutes(t) || 0), 0);
    const tierAvgResp = tierResponded.length > 0 ? Math.round(tierTotalResp / tierResponded.length) : 0;

    const tierBreaches = tierTickets.filter((t) => isTicketSlaBreached(t)).length;
    const tierTarget = SLA_TARGETS_MINUTES[tier];
    const adherence = tierTickets.length > 0 ? Math.round(((tierTickets.length - tierBreaches) / tierTickets.length) * 100) : 100;

    return {
      tier,
      count: tierTickets.length,
      activeCount: tierTickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length,
      avgResponseMinutes: tierAvgResp,
      breaches: tierBreaches,
      targetMinutes: tierTarget,
      adherence,
    };
  });

  // 6. Breakdowns by Priority
  const priorities: TicketPriority[] = ['critical', 'high', 'normal', 'low'];
  const priorityStats = priorities.map((prio) => {
    const prioTickets = allTickets.filter((t) => t.priority === prio);
    const prioResponded = prioTickets.filter((t) => Boolean(t.first_responded_at));
    const prioTotalResp = prioResponded.reduce((acc, t) => acc + (getTicketResponseTimeMinutes(t) || 0), 0);
    const prioAvgResp = prioResponded.length > 0 ? Math.round(prioTotalResp / prioResponded.length) : 0;

    return {
      priority: prio,
      count: prioTickets.length,
      avgResponseMinutes: prioAvgResp,
    };
  });

  // 7. Customers list for the "Verify or Refute Customer Claims" tool
  const uniqueCustomersMap = new Map<string, { id: string; name: string; email: string; tier: CustomerTier }>();
  for (const t of allTickets) {
    if (t.customer_id && t.customer) {
      uniqueCustomersMap.set(t.customer_id, {
        id: t.customer_id,
        name: t.customer.name || 'Customer',
        email: t.customer.email,
        tier: (t.customer.tier || 'small') as CustomerTier,
      });
    }
  }
  const customersList = Array.from(uniqueCustomersMap.values());

  // Currently inspected customer
  const activeCustomer = customersList.find((c) => c.id === selectedCustomerId) || customersList[0];
  const customerTickets = activeCustomer ? allTickets.filter((t) => t.customer_id === activeCustomer.id) : [];
  const customerResponded = customerTickets.filter((t) => Boolean(t.first_responded_at));
  const customerTotalResp = customerResponded.reduce((acc, t) => acc + (getTicketResponseTimeMinutes(t) || 0), 0);
  const customerAvgRespMinutes = customerResponded.length > 0 ? Math.round(customerTotalResp / customerResponded.length) : 0;

  const customerResolved = customerTickets.filter((t) => Boolean(t.resolved_at));
  const customerTotalResol = customerResolved.reduce((acc, t) => acc + (getTicketResolutionTimeMinutes(t) || 0), 0);
  const customerAvgResolMinutes = customerResolved.length > 0 ? Math.round(customerTotalResol / customerResolved.length) : 0;

  const customerBreaches = customerTickets.filter((t) => isTicketSlaBreached(t));
  const customerTarget = activeCustomer ? SLA_TARGETS_MINUTES[activeCustomer.tier] : 60;
  const isCustomerSlow = customerAvgRespMinutes > customerTarget || customerBreaches.length > 0;

  return (
    <div className="rounded-2xl border border-purple-200 bg-linear-to-r from-purple-50/70 via-indigo-50/40 to-white p-5 shadow-xs space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-purple-100 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
            <Crown className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-zinc-900">
                Founder SLA Command Center & Performance Audit
              </h2>
              <Badge variant="purple" className="text-[10px] py-0 px-1.5 h-4">
                Executive SLA
              </Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Honest operational visibility answering: &quot;Are we slow?&quot; with mathematical audit trails.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetailedBreakdowns(!showDetailedBreakdowns)}
            className="h-7 text-xs gap-1 border-purple-200 text-purple-800 hover:bg-purple-100/50"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{showDetailedBreakdowns ? 'Hide Plan Breakdowns' : 'View Plan & Priority Breakdowns'}</span>
            {showDetailedBreakdowns ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <Activity className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
            <span>Live Audit Active</span>
          </div>
        </div>
      </div>

      {/* Primary 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Avg First Response Time */}
        <Card className="border-purple-100 bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Avg First Response
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold text-zinc-900 font-mono">
                  {formatMinutes(avgResponseTimeMinutes)}
                </span>
                <span className="text-[11px] text-zinc-400">across {respondedTickets.length} tickets</span>
              </div>
              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                Target: &lt;60m Enterprise, &lt;4h Substantial
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Avg Resolution Time */}
        <Card className="border-purple-100 bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Avg Resolution Time
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold text-zinc-900 font-mono">
                  {formatMinutes(avgResolutionTimeMinutes)}
                </span>
                <span className="text-[11px] text-zinc-400">({fullyResolvedTickets.length} resolved)</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                From creation to Mark Resolved
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Active Backlog Breakdown */}
        <Card className="border-purple-100 bg-white shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Active Backlog
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold text-zinc-900 font-mono">
                  {activeTickets.length}
                </span>
                <span className="text-[11px] text-zinc-400">unresolved</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {waitingCustomerCount} wait client, {waitingInternalCount} wait int, {reopenedCount} reopened
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: SLA Breaches & Stale Tickets */}
        <Card className={`shadow-2xs ${breachedTickets.length > 0 ? 'border-red-200 bg-red-50/30' : 'border-purple-100 bg-white'}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                SLA Breaches / Stale
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-2xl font-bold font-mono ${breachedTickets.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {breachedTickets.length} Breaches
                </span>
                <span className="text-[11px] text-zinc-400">({staleTickets.length} stale)</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {breachedTickets.length === 0 ? 'Zero breaches active across all tiers' : 'Immediate founder attention needed'}
              </p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${breachedTickets.length > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan and Priority Breakdowns (Collapsible) */}
      {showDetailedBreakdowns && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in-50 pt-2 border-t border-purple-100">
          {/* Plan Breakdown */}
          <Card className="border-purple-100 bg-white shadow-2xs">
            <CardHeader className="p-3.5 pb-2 border-b border-zinc-100">
              <CardTitle className="text-xs font-bold text-zinc-800">
                Performance Breakdown by Contract Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[10px] uppercase font-semibold text-zinc-500 border-b border-zinc-100">
                  <tr>
                    <th className="px-3 py-2">Plan Tier</th>
                    <th className="px-3 py-2">Volume</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Avg First Reply</th>
                    <th className="px-3 py-2">SLA Adherence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {planStats.map((ps) => (
                    <tr key={ps.tier} className="hover:bg-zinc-50/70">
                      <td className="px-3 py-2 font-semibold capitalize text-zinc-900">
                        {ps.tier}
                      </td>
                      <td className="px-3 py-2 font-mono text-zinc-600">
                        {ps.count} ({ps.activeCount} active)
                      </td>
                      <td className="px-3 py-2 font-mono text-zinc-500">
                        &lt;{formatMinutes(ps.targetMinutes)}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-purple-900">
                        {ps.avgResponseMinutes > 0 ? formatMinutes(ps.avgResponseMinutes) : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ps.adherence >= 90 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {ps.adherence}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Priority Breakdown */}
          <Card className="border-purple-100 bg-white shadow-2xs">
            <CardHeader className="p-3.5 pb-2 border-b border-zinc-100">
              <CardTitle className="text-xs font-bold text-zinc-800">
                Response Times by Ticket Priority Urgency
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[10px] uppercase font-semibold text-zinc-500 border-b border-zinc-100">
                  <tr>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Total Tickets</th>
                    <th className="px-3 py-2">Avg First Response Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {priorityStats.map((prs) => (
                    <tr key={prs.priority} className="hover:bg-zinc-50/70">
                      <td className="px-3 py-2 font-semibold capitalize text-zinc-900">
                        {prs.priority}
                      </td>
                      <td className="px-3 py-2 font-mono text-zinc-600">
                        {prs.count}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-purple-900">
                        {prs.avgResponseMinutes > 0 ? formatMinutes(prs.avgResponseMinutes) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Customer Claim Verification Tool (Defend against "You Are Slow" complaints) */}
      <div className="rounded-xl border border-purple-200/80 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-600" />
            <div>
              <h3 className="text-xs font-bold text-zinc-900">
                Customer Claim Verifier (&quot;Are We Slow to Customer X?&quot;)
              </h3>
              <p className="text-[11px] text-zinc-500">
                Select a client account to instantly verify or refute claims that support has been slow.
              </p>
            </div>
          </div>

          {/* Customer Selector Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-zinc-600 shrink-0">Account:</label>
            <select
              value={activeCustomer?.id || ''}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="rounded-md border border-purple-200 bg-purple-50/40 px-2.5 py-1 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
            >
              {customersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.tier.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeCustomer && (
          <div className="space-y-3 pt-1">
            {/* The Concrete Founder Verdict Banner */}
            <div
              className={`rounded-lg p-3 border text-xs flex items-start gap-2.5 ${
                !isCustomerSlow
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              {!isCustomerSlow ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5 flex-1">
                <p className="font-bold">
                  {!isCustomerSlow
                    ? `Claim Refuted: Fast Performance for ${activeCustomer.name}`
                    : `Claim Verified: Response Delays Recorded for ${activeCustomer.name}`}
                </p>
                <p className="text-[11px] text-zinc-700 leading-relaxed">
                  {!isCustomerSlow ? (
                    <>
                      <strong>{activeCustomer.name}</strong> claims you are slow, but their average first response time is{' '}
                      <span className="font-mono font-bold text-emerald-800">{formatMinutes(customerAvgRespMinutes)}</span>, which beats their{' '}
                      <span className="font-mono font-bold">{formatMinutes(customerTarget)}</span> contract SLA target.{' '}
                      <strong>0 breaches</strong> were recorded across {customerTickets.length} total tickets.
                    </>
                  ) : (
                    <>
                      <strong>{activeCustomer.name}</strong> experienced{' '}
                      <span className="font-bold text-red-700">{customerBreaches.length} SLA breach(es)</span> with an average response time of{' '}
                      <span className="font-mono font-bold text-amber-900">{formatMinutes(customerAvgRespMinutes)}</span> against their{' '}
                      <span className="font-mono font-bold">{formatMinutes(customerTarget)}</span> contract SLA limit.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Quick Metrics for this Customer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md bg-zinc-50 p-2 border border-zinc-100">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold">Total Tickets</span>
                <p className="font-mono font-bold text-zinc-900 text-sm mt-0.5">{customerTickets.length}</p>
              </div>
              <div className="rounded-md bg-zinc-50 p-2 border border-zinc-100">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold">Avg First Reply</span>
                <p className="font-mono font-bold text-purple-900 text-sm mt-0.5">
                  {customerAvgRespMinutes > 0 ? formatMinutes(customerAvgRespMinutes) : 'No replies yet'}
                </p>
              </div>
              <div className="rounded-md bg-zinc-50 p-2 border border-zinc-100">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold">Avg Resolution</span>
                <p className="font-mono font-bold text-emerald-900 text-sm mt-0.5">
                  {customerAvgResolMinutes > 0 ? formatMinutes(customerAvgResolMinutes) : 'In progress'}
                </p>
              </div>
              <div className="rounded-md bg-zinc-50 p-2 border border-zinc-100">
                <span className="text-[10px] text-zinc-500 uppercase font-semibold">Contract SLA Limit</span>
                <p className="font-mono font-bold text-zinc-900 text-sm mt-0.5">
                  &lt;{formatMinutes(customerTarget)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
