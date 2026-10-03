'use client';

import React, { useState, useTransition } from 'react';
import { assignTicket } from '@/actions/ticketActions';
import { UserCheck, UserX, Loader2 } from 'lucide-react';

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
}

export function TicketAssigneeSelector({
  ticketId,
  currentAssigneeId,
  staffMembers,
}: TicketAssigneeSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(currentAssigneeId || '');
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleAssignChange = (newAgentId: string) => {
    const targetId = newAgentId === '' ? null : newAgentId;
    setSelectedId(newAgentId);

    startTransition(async () => {
      setStatusMessage(null);
      const res = await assignTicket(ticketId, targetId);
      if (res.success) {
        setStatusMessage('Assignee updated');
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage(res.error || 'Failed to reassign');
      }
    });
  };

  const currentMember = staffMembers.find((m) => m.id === selectedId);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
        {selectedId ? (
          <UserCheck className="h-3.5 w-3.5 text-blue-600" />
        ) : (
          <UserX className="h-3.5 w-3.5 text-zinc-400" />
        )}
        <span>Owner:</span>
      </div>

      <div className="relative inline-block">
        <select
          value={selectedId}
          disabled={isPending}
          onChange={(e) => handleAssignChange(e.target.value)}
          className="h-8 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-2xs hover:border-zinc-300 focus:border-zinc-500 focus:outline-none transition-colors cursor-pointer disabled:opacity-50"
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

      {statusMessage && (
        <span className="text-[11px] font-medium text-emerald-600 animate-in fade-in-0">
          {statusMessage}
        </span>
      )}
    </div>
  );
}
