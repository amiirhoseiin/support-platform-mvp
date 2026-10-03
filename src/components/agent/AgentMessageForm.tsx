'use client';

import * as React from 'react';
import { useRef, useState, useTransition } from 'react';
import { sendMessage, generateAiDraft } from '@/actions/ticketActions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Lock, Sparkles, Loader2, AlertCircle, MessageSquare } from 'lucide-react';

interface AgentMessageFormProps {
  ticketId: string;
}

export function AgentMessageForm({ ticketId }: AgentMessageFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append('ticketId', ticketId);
    formData.append('isInternalNote', isInternalNote ? 'true' : 'false');

    startTransition(async () => {
      const result = await sendMessage(formData);
      if (result.success) {
        formRef.current?.reset();
        setIsInternalNote(false);
      } else {
        setError(result.error || 'Failed to send message.');
      }
    });
  };

  const handleGenerateAiDraft = async () => {
    setError(null);
    setIsGeneratingAi(true);
    try {
      const result = await generateAiDraft(ticketId);
      if (!result.success) {
        setError(result.error || 'Failed to generate AI draft.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating AI draft.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-colors p-5 shadow-sm space-y-4 ${
        isInternalNote
          ? 'border-amber-300 bg-amber-50/40'
          : 'border-zinc-200 bg-white'
      }`}
    >
      {/* Header bar with AI draft trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-3">
        <div className="flex items-center gap-2">
          {isInternalNote ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
              <Lock className="h-4 w-4" />
              <span>Internal Staff Note</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
              <MessageSquare className="h-4 w-4 text-zinc-500" />
              <span>Public Response to Customer</span>
            </div>
          )}
          <span className="text-zinc-400 text-xs">|</span>
          <span className="text-[11px] text-zinc-500">
            {isInternalNote
              ? 'Only visible to agents and founder. Never seen by customer.'
              : 'Will be sent directly to customer portal.'}
          </span>
        </div>

        {/* Phase 4 AI Draft Button */}
        <Button
          type="button"
          onClick={handleGenerateAiDraft}
          disabled={isGeneratingAi || isPending}
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs border-purple-200 bg-purple-50/70 text-purple-700 hover:bg-purple-100 hover:text-purple-900 shadow-2xs font-medium"
        >
          {isGeneratingAi ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
              <span>Generating AI Draft...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              <span>Generate AI Draft</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          name="body"
          placeholder={
            isInternalNote
              ? 'Add private technical notes, troubleshooting steps, or instructions for colleagues...'
              : 'Write your professional response to the customer...'
          }
          rows={4}
          required
          disabled={isPending || isGeneratingAi}
          className={`resize-y ${
            isInternalNote
              ? 'bg-amber-50/30 border-amber-200 focus-visible:ring-amber-500'
              : 'bg-white'
          }`}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Internal note toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isInternalNote}
              onChange={(e) => setIsInternalNote(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
            />
            <span
              className={`text-xs font-semibold ${
                isInternalNote ? 'text-amber-900' : 'text-zinc-600'
              }`}
            >
              Send as Internal Note
            </span>
          </label>

          <Button
            type="submit"
            disabled={isPending || isGeneratingAi}
            size="sm"
            className={`h-9 px-4 gap-2 text-xs font-medium shadow-sm ${
              isInternalNote
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : isInternalNote ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>Add Internal Note</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Send to Customer</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
