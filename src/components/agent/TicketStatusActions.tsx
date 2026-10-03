'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { updateTicketStatus } from '@/actions/ticketActions';
import { Button } from '@/components/ui/button';
import { TicketStatus } from '@/types/database';
import { CheckCircle2, RotateCcw, PlayCircle, Loader2 } from 'lucide-react';

interface TicketStatusActionsProps {
  ticketId: string;
  currentStatus: TicketStatus;
}

export function TicketStatusActions({ ticketId, currentStatus }: TicketStatusActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: TicketStatus) => {
    startTransition(async () => {
      await updateTicketStatus(ticketId, newStatus);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {currentStatus === 'open' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('in_progress')}
          className="h-8 gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" />
          )}
          <span>Start Working</span>
        </Button>
      )}

      {currentStatus !== 'resolved' && currentStatus !== 'closed' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('resolved')}
          className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          <span>Mark Resolved</span>
        </Button>
      )}

      {(currentStatus === 'resolved' || currentStatus === 'closed') && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('in_progress')}
          className="h-8 gap-1.5 text-xs text-zinc-700 border-zinc-200 hover:bg-zinc-100"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          <span>Reopen Ticket</span>
        </Button>
      )}
    </div>
  );
}
