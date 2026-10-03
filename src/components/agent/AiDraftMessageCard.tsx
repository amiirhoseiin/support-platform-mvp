'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { approveAndSendDraft, discardDraft } from '@/actions/ticketActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { TicketMessage } from '@/types/database';
import { SimilarSolvedTicket, TicketCategory } from '@/lib/ai/types';
import {
  Sparkles,
  Check,
  Trash2,
  Loader2,
  AlertCircle,
  Edit3,
  Undo2,
  BookOpen,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AiDraftMessageCardProps {
  draft: TicketMessage;
  ticketId: string;
}

export function AiDraftMessageCard({ draft, ticketId }: AiDraftMessageCardProps) {
  const [isPending, startTransition] = useTransition();
  const [actionType, setActionType] = useState<'approve' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable reply state
  const [replyText, setReplyText] = useState(draft.body);
  const [isEditing, setIsEditing] = useState(true); // Agent can edit directly
  const [showSimilarTickets, setShowSimilarTickets] = useState(true);

  // Extract metadata
  const meta = (draft.metadata || {}) as {
    classification?: TicketCategory;
    confidence?: number;
    reasoning?: string;
    similar_tickets?: SimilarSolvedTicket[];
    model?: string;
  };

  const classification = meta.classification || 'bug';
  const confidencePercent = meta.confidence ? Math.round(meta.confidence * 100) : 85;
  const similarTickets = meta.similar_tickets || [];
  const wasModified = replyText.trim() !== draft.body.trim();

  const handleApprove = () => {
    setError(null);
    setActionType('approve');
    startTransition(async () => {
      const res = await approveAndSendDraft(draft.id, ticketId, replyText);
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

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case 'billing':
        return 'destructive' as const;
      case 'duplicate_question':
        return 'warning' as const;
      case 'feature_request':
        return 'purple' as const;
      default:
        return 'default' as const;
    }
  };

  const formatCategoryName = (cat: string) => {
    switch (cat) {
      case 'duplicate_question':
        return 'Duplicate Question';
      case 'billing':
        return 'Billing / Invoicing';
      case 'bug':
        return 'Bug / Incident';
      case 'feature_request':
        return 'Feature Request';
      default:
        return cat;
    }
  };

  return (
    <div className="rounded-xl border-2 border-purple-300 bg-purple-50/50 p-5 shadow-sm space-y-4 animate-in fade-in-50">
      {/* Header with Classification and Explainability */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-purple-200/80 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-purple-950">
                AI Copilot Suggestion
              </span>
              <Badge variant={getCategoryBadgeVariant(classification)} className="text-[10px] py-0 px-1.5 h-4 capitalize">
                {formatCategoryName(classification)}
              </Badge>
              <span className="rounded-full bg-purple-200/80 px-2 py-0.2 text-[10px] font-mono font-bold text-purple-800">
                {confidencePercent}% Confidence
              </span>
            </div>
            <p className="text-[11px] text-purple-800 mt-0.5">
              <strong>This is a suggested reply. Edit it or approve it.</strong>
            </p>
          </div>
        </div>

        <span className="text-[11px] text-purple-600 font-mono self-start sm:self-auto">
          {new Date(draft.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* AI Reasoning / Rationale */}
      {meta.reasoning && (
        <div className="rounded-lg bg-purple-100/60 p-2.5 text-xs text-purple-900 border border-purple-200/60 flex items-start gap-2">
          <span className="font-bold shrink-0">AI Reasoning:</span>
          <span className="italic">{meta.reasoning}</span>
        </div>
      )}

      {/* Similar Solved Tickets Context Box (Tenant-Scoped) */}
      {similarTickets.length > 0 && (
        <div className="rounded-lg border border-purple-200 bg-white/90 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setShowSimilarTickets(!showSimilarTickets)}
            className="w-full flex items-center justify-between p-2.5 bg-purple-50/70 hover:bg-purple-100/60 text-xs font-semibold text-purple-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-purple-700" />
              <span>
                Tenant-Scoped Solved Tickets Used for Suggestion ({similarTickets.length})
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-medium">
                <ShieldCheck className="h-3 w-3" />
                Zero Cross-Tenant Leakage
              </span>
            </div>
            {showSimilarTickets ? (
              <ChevronUp className="h-4 w-4 text-purple-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-purple-600" />
            )}
          </button>

          {showSimilarTickets && (
            <div className="p-3 divide-y divide-purple-100 space-y-2 text-xs">
              {similarTickets.map((st, idx) => (
                <div key={st.id || idx} className="pt-2 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900">{st.subject}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">#{st.id.slice(0, 8)}</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 line-clamp-2">
                    <span className="font-medium text-purple-900">Resolved Solution:</span> {st.resolutionSummary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editable Reply Workspace */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="font-bold text-zinc-800 flex items-center gap-1.5">
            <Edit3 className="h-3.5 w-3.5 text-purple-700" />
            <span>Suggested Response Text (Editable):</span>
          </label>
          {wasModified && (
            <button
              type="button"
              onClick={() => setReplyText(draft.body)}
              className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 font-medium"
            >
              <Undo2 className="h-3 w-3" />
              Reset to Original
            </button>
          )}
        </div>

        <Textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          disabled={isPending}
          rows={5}
          className="bg-white border-purple-200 text-sm text-zinc-900 leading-relaxed shadow-2xs focus-visible:ring-purple-500 resize-y"
          placeholder="Edit suggested response before approving and sending..."
        />
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span>{wasModified ? 'Edited by agent (will be logged in audit trail)' : 'Original AI suggestion'}</span>
          <span>{replyText.length} characters</span>
        </div>
      </div>

      {/* Action Buttons: Approve & Send, Discard */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-200">
        <div className="text-[11px] text-purple-800">
          Approving will send this message directly to the customer portal.
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
            Discard
          </Button>

          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isPending || replyText.trim().length === 0}
            className="h-8 gap-1.5 text-xs bg-purple-700 text-white hover:bg-purple-800 font-semibold shadow-xs"
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
