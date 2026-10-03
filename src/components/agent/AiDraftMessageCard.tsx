'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { approveAndSendDraft, discardDraft } from '@/actions/ticketActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TicketMessage } from '@/types/database';
import { Sparkles, Check, Trash2, Loader2, AlertCircle } from 'lucide-react';

interface AiDraftMessageCardProps {
  draft: TicketMessage;
  ticketId: string;
}

export function AiDraftMessageCard({ draft, ticketId }: AiDraftMessageCardProps) {
  const [isPending, startTransition] = useTransition();
  const [actionType, setActionType] = useState<'approve' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    setActionType('approve');
    startTransition(async () => {
      const res = await approveAndSendDraft(draft.id, ticketId);
      if (!res.success) {
        setError(res.error || 'Failed to approve draft');
        setActionType(null);
      }
    });
  };

  const handleDiscard = () => {
    setError(null);
    setActionType('discard');
    startTransition(async () => {
      const res = await discardDraft(draft.id, ticketId);
      if (!res.success) {
        setError(res.error || 'Failed to discard draft');
        setActionType(null);
      }
    });
  };

  return (
    <div className="rounded-xl border-2 border-purple-300 bg-purple-50/60 p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-purple-200 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-600 text-white shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-950">
                AI Copilot Draft
              </span>
              <Badge variant="purple" className="text-[10px] py-0 px-1.5 h-4">
                Pending Agent Review
              </Badge>
            </div>
            <p className="text-[11px] text-purple-700">
              Not visible to the customer until approved.
            </p>
          </div>
        </div>

        <span className="text-[11px] text-purple-600 font-mono">
          {new Date(draft.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Draft text body */}
      <div className="rounded-lg bg-white p-3.5 border border-purple-200 text-sm text-zinc-900 whitespace-pre-wrap leading-relaxed shadow-2xs">
        {draft.body}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="text-[11px] text-purple-700 italic">
          Review the draft for tone and accuracy before sending.
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDiscard}
            disabled={isPending}
            className="h-8 gap-1 text-xs text-zinc-600 hover:text-red-600 hover:bg-red-50"
          >
            {isPending && actionType === 'discard' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Discard Draft
          </Button>

          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isPending}
            className="h-8 gap-1.5 text-xs bg-purple-700 text-white hover:bg-purple-800 shadow-sm"
          >
            {isPending && actionType === 'approve' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Approving & Sending...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Approve & Send</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
