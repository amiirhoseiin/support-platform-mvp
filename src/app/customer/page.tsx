import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { Navbar } from '@/components/Navbar';
import { NewTicketDialog } from '@/components/customer/NewTicketDialog';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ticket, UserProfile } from '@/types/database';
import { Ticket as TicketIcon, Clock, ChevronRight, Inbox, CheckCircle2, AlertCircle } from 'lucide-react';

export default async function CustomerDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/customer');
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Fetch customer tickets (RLS automatically enforces customer_id = user.id)
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  const ticketList: Ticket[] = tickets || [];

  const openCount = ticketList.filter((t) => t.status === 'open').length;
  const inProgressCount = ticketList.filter((t) => t.status === 'in_progress').length;
  const resolvedCount = ticketList.filter((t) => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar user={profile as UserProfile} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Customer Support Portal
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Submit issues, view real-time responses from our technical team, and track resolution.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NewTicketDialog />
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-zinc-200">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Open Tickets</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{openCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">In Progress</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{inProgressCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Resolved</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{resolvedCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tickets Table / List */}
        <Card className="border-zinc-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-zinc-100 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Your Support Tickets</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  All requests submitted by your organization
                </CardDescription>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {ticketList.length} {ticketList.length === 1 ? 'ticket' : 'tickets'} total
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {ticketList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
                  <Inbox className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900">No support tickets found</h3>
                <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4">
                  Need help with integration, infrastructure, or billing? Submit your first ticket now.
                </p>
                <NewTicketDialog />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50/75 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th scope="col" className="px-6 py-3">Subject</th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3">Priority</th>
                      <th scope="col" className="px-6 py-3">Created</th>
                      <th scope="col" className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {ticketList.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="transition-colors hover:bg-zinc-50/75 group"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/customer/${ticket.id}`}
                            className="block font-medium text-zinc-900 group-hover:text-blue-600 transition-colors"
                          >
                            <span className="text-sm font-semibold">{ticket.subject}</span>
                            <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5 max-w-md">
                              {ticket.description}
                            </p>
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <PriorityBadge priority={ticket.priority} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-500 font-mono">
                          {new Date(ticket.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link href={`/customer/${ticket.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                              View
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
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

