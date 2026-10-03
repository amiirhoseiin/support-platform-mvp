'use client';

import * as React from 'react';
import { useRef, useState, useTransition } from 'react';
import { sendMessage } from '@/actions/ticketActions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, AlertCircle } from 'lucide-react';

interface CustomerMessageFormProps {
  ticketId: string;
}

export function CustomerMessageForm({ ticketId }: CustomerMessageFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append('ticketId', ticketId);
    formData.append('isInternalNote', 'false');

    startTransition(async () => {
      const result = await sendMessage(formData);
      if (result.success) {
        formRef.current?.reset();
      } else {
        setError(result.error || 'Failed to send message. Please try again.');
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900 mb-2">Send a Reply</h3>
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          name="body"
          placeholder="Type your response or provide requested details..."
          rows={3}
          required
          disabled={isPending}
          className="resize-y"
        />

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-zinc-400">
            Press Send to reply to the support team
          </p>
          <Button
            type="submit"
            disabled={isPending}
            size="sm"
            className="flex items-center gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span>Send Reply</span>
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

