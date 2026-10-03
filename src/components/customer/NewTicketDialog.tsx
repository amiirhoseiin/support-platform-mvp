'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTicket } from '@/actions/ticketActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PlusCircle, Loader2, AlertCircle } from 'lucide-react';

export function NewTicketDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createTicket(formData);
      if (result.success && result.data) {
        setOpen(false);
        form.reset();
        router.push(`/customer/${result.data.ticketId}`);
      } else {
        setError(result.error || 'Failed to create ticket. Please try again.');
      }
    });
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800"
      >
        <PlusCircle className="h-4 w-4" />
        New Ticket
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Submit a New Support Ticket</DialogTitle>
          <DialogDescription>
            Describe the issue in detail. Our support engineering team will prioritize and respond promptly.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="subject" className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <Input
              id="subject"
              name="subject"
              placeholder="Brief summary of the issue (e.g., API 500 error on /users endpoint)"
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="priority" className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue="normal"
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 text-zinc-900"
            >
              <option value="low">Low - General inquiry or suggestion</option>
              <option value="normal">Normal - Standard issue or question</option>
              <option value="high">High - Impaired functionality, urgent</option>
              <option value="critical">Critical - Complete outage / data loss</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              Description <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              placeholder="Provide exact steps to reproduce, error codes, affected tenant ID, or relevant logs..."
              required
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="flex items-center gap-2">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Create Ticket'
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

