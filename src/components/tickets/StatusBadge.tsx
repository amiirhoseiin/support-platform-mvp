import { Badge } from '@/components/ui/badge';
import { TicketStatus } from '@/types/database';

export function StatusBadge({ status }: { status: TicketStatus }) {
  switch (status) {
    case 'open':
      return <Badge variant="warning">Open</Badge>;
    case 'in_progress':
      return <Badge variant="default">In Progress</Badge>;
    case 'waiting_customer':
      return <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-300">Waiting on Customer</Badge>;
    case 'waiting_internal':
      return <Badge variant="outline" className="text-indigo-800 bg-indigo-50 border-indigo-300">Waiting on Internal</Badge>;
    case 'reopened':
      return <Badge variant="destructive" className="bg-rose-600 text-white">Reopened</Badge>;
    case 'resolved':
      return <Badge variant="success">Resolved</Badge>;
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

