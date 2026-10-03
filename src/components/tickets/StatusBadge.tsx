import { Badge } from '@/components/ui/badge';
import { TicketStatus } from '@/types/database';

export function StatusBadge({ status }: { status: TicketStatus }) {
  switch (status) {
    case 'open':
      return <Badge variant="warning">Open</Badge>;
    case 'in_progress':
      return <Badge variant="default">In Progress</Badge>;
    case 'resolved':
      return <Badge variant="success">Resolved</Badge>;
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

