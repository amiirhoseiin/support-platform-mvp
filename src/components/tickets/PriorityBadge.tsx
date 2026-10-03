import { Badge } from '@/components/ui/badge';
import { TicketPriority } from '@/types/database';

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  switch (priority) {
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
    case 'high':
      return <Badge variant="warning">High</Badge>;
    case 'normal':
      return <Badge variant="secondary">Normal</Badge>;
    case 'low':
      return <Badge variant="outline">Low</Badge>;
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
}

