'use client';

import React, { useState, useTransition } from 'react';
import { assignTicket } from '@/actions/ticketActions';
import { UserCheck, UserX, Loader2, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'agent' | 'founder';
}

interface TicketAssigneeSelectorProps {
  ticketId: string;
  currentAssigneeId?: string | null;
  staffMembers: StaffUser[];
  currentUserRole?: 'customer' | 'agent' | 'founder';
  currentUserId?: string;
}

export function TicketAssigneeSelector({
  ticketId,
  currentAssigneeId,
  staffMembers,
  currentUserRole = 'agent',
  currentUserId,
}: TicketAssigneeSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(currentAssigneeId || '');
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const isFounder = currentUserRole === 'founder';
  const isAssignedToMe = currentUserId ? selectedId === currentUserId : false;
  const isAssignedToOther = selectedId && currentUserId ? selectedId !== currentUserId : false;
  const currentMember = staffMembers.find((m) => m.id === selectedId);

  const handleAssignChange = (newAgentId: string | null) => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await assignTicket(ticketId, newAgentId);
      if (res.success) {
        setSelectedId(newAgentId || '');
        setStatusMessage({
          text: newAgentId
            ? newAgentId === currentUserId
              ? 'Claimed ticket!'
              : 'Assignee updated'
            : 'Ticket released to queue',
        });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ text: res.error || 'Failed to update assignee', isError: true });
      }
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      {/* FOUNDER VIEW: Full dropdown selector across all staff members */}
      {isFounder ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
            {selectedId ? (
              <UserCheck className="h-3.5 w-3.5 text-blue-600" />
            ) : (
              <UserX className="h-3.5 w-3.5 text-zinc-400" />
            )}
            <span>Assignee:</span>
          </div>

          <div className="relative inline-block">
            <select
              value={selectedId}
              disabled={isPending}
              onChange={(e) => handleAssignChange(e.target.value === '' ? null : e.target.value)}
              className="h-8 rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-2xs hover:border-purple-300 focus:border-purple-500 focus:outline-none transition-colors cursor-pointer disabled:opacity-50"
            >
              <option value="">(Unassigned)</option>
              {staffMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} {member.role === 'founder' ? '(Founder)' : '(Support)'}
                </option>
              ))}
            </select>

            {isPending && (
              <span className="absolute right-2 top-2">
                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
              </span>
            )}
          </div>
        </div>
      ) : (
        /* AGENT VIEW: Agents can only claim for themselves or release their own ticket */
        <div className="flex items-center gap-2">
          {isAssignedToMe ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 border border-blue-200">
                <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                Assigned to You
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleAssignChange(null)}
                className="h-7 text-xs text-zinc-600 hover:text-zinc-900 border-zinc-200"
                title="Release ticket back to the unassigned queue"
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Release to Queue'}
              </Button>
            </div>
          ) : isAssignedToOther ? (
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200">
              <span className="font-semibold text-zinc-800">{currentMember?.name || 'Colleague'}</span>
              <span className="text-[10px] text-zinc-400 italic">(Founder can reassign)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                Unassigned
              </span>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => handleAssignChange(currentUserId || null)}
                className="h-7 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <UserCheck className="h-3 w-3" />
                    Claim Ticket
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {statusMessage && (
        <span
          className={`text-[11px] font-medium animate-in fade-in-0 ${
            statusMessage.isError ? 'text-red-600' : 'text-emerald-600'
          }`}
        >
          {statusMessage.text}
        </span>
      )}
    </div>
  );
}
