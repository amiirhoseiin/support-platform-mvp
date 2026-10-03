'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AutoReplySettingsDialog } from './AutoReplySettingsDialog';
import { Bot, Sliders } from 'lucide-react';

interface AutoReplySettingsTriggerProps {
  currentUserRole?: string;
}

export function AutoReplySettingsTrigger({
  currentUserRole,
}: AutoReplySettingsTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-8 gap-1.5 text-xs border-purple-200 bg-purple-50/60 text-purple-800 hover:bg-purple-100/80 hover:text-purple-950 font-medium shadow-2xs"
      >
        <Bot className="h-3.5 w-3.5 text-purple-600" />
        <span>Auto-Reply Settings</span>
      </Button>

      <AutoReplySettingsDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        currentUserRole={currentUserRole}
      />
    </>
  );
}

