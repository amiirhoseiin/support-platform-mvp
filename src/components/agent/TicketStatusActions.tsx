'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { updateTicketStatus } from '@/actions/ticketActions';
import { Button } from '@/components/ui/button';
import { TicketStatus } from '@/types/database';
import {
  CheckCircle2,
  RotateCcw,
  PlayCircle,
  Clock,
  Building2,
  Loader2,
} from 'lucide-react';

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
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Open -> Start Working */}
      {currentStatus === 'open' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('in_progress')}
          className="h-8 gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          <span>Start Working</span>
        </Button>
      )}

      {/* Waiting on Customer toggle */}
      {currentStatus !== 'waiting_customer' && currentStatus !== 'resolved' && currentStatus !== 'closed' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('waiting_customer')}
          className="h-8 gap-1 text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
          title="Mark as waiting for customer response"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          <span>Wait Customer</span>
        </Button>
      )}

      {/* Waiting on Internal toggle */}
      {currentStatus !== 'waiting_internal' && currentStatus !== 'resolved' && currentStatus !== 'closed' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('waiting_internal')}
          className="h-8 gap-1 text-xs text-indigo-800 border-indigo-200 hover:bg-indigo-50"
          title="Mark as waiting on internal escalation / engineering"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
          <span>Wait Internal</span>
        </Button>
      )}

      {/* Resume In Progress if in waiting state */}
      {(currentStatus === 'waiting_customer' || currentStatus === 'waiting_internal' || currentStatus === 'reopened') && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('in_progress')}
          className="h-8 gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          <span>Resume Work</span>
        </Button>
      )}

      {/* Mark Resolved */}
      {currentStatus !== 'resolved' && currentStatus !== 'closed' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('resolved')}
          className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          <span>Mark Resolved</span>
        </Button>
      )}

      {/* Reopen Ticket (if resolved or closed) */}
      {(currentStatus === 'resolved' || currentStatus === 'closed') && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange('reopened')}
          className="h-8 gap-1.5 text-xs text-rose-700 border-rose-200 hover:bg-rose-50 font-semibold"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          <span>Reopen Ticket</span>
        </Button>
      )}
    </div>
  );
}
