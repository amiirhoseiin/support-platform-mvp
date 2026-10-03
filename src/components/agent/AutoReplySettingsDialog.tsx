'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  getAutoReplySettingsAction,
  updateAutoReplySettingsAction,
} from '@/actions/ticketActions';
import { AutoReplyConfig, TicketCategory } from '@/lib/ai/types';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ShieldAlert,
  ShieldCheck,
  Check,
  Loader2,
  Sliders,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface AutoReplySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserRole?: string;
}

export function AutoReplySettingsDialog({
  open,
  onOpenChange,
  currentUserRole,
}: AutoReplySettingsDialogProps) {
  const [config, setConfig] = useState<AutoReplyConfig>({
    enabled: false,
    min_confidence: 0.85,
    allowed_categories: ['duplicate_question', 'feature_request'],
    excluded_categories: ['billing', 'security', 'bug'],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      getAutoReplySettingsAction()
        .then((res) => {
          setConfig(res);
        })
        .catch((err) => {
          console.error('Failed to load settings:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open]);

  const handleToggleEnabled = (enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enabled }));
  };

  const handleCategoryToggle = (category: TicketCategory) => {
    setConfig((prev) => {
      const current = prev.allowed_categories || [];
      const updated = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      return { ...prev, allowed_categories: updated };
    });
  };

  const handleSave = () => {
    setStatusMsg(null);
    startTransition(async () => {
      const res = await updateAutoReplySettingsAction(config);
      if (res.success) {
        setStatusMsg({ text: 'Auto-reply settings saved successfully!' });
        setTimeout(() => {
          setStatusMsg(null);
          onOpenChange(false);
        }, 1500);
      } else {
        setStatusMsg({ text: res.error || 'Failed to save settings', isError: true });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-2xs">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle>AI Auto-Reply & Safety Policy</DialogTitle>
            <DialogDescription>
              Configure automated responses for incoming customer tickets.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          {/* Master Enable Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-900 text-sm">Automated AI Auto-Reply</span>
                <Badge variant={config.enabled ? 'success' : 'outline'} className="text-[10px]">
                  {config.enabled ? 'ACTIVE' : 'DISABLED (Default)'}
                </Badge>
              </div>
              <p className="text-zinc-500 text-[11px] mt-0.5">
                When enabled, the AI will automatically reply only to high-confidence low-risk tickets.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Strict Safety Policy Callout */}
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/70 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
              <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
              <span>Safety & Policy Guardrails (Hard Invariants)</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-900 leading-relaxed">
              <li>
                <strong>Billing, Security & Bug tickets</strong> always require human review. The system <em>never</em> auto-replies to them.
              </li>
              <li>
                <strong>Never auto-closes tickets:</strong> An auto-reply marks the ticket as <code>in_progress</code>, never <code>resolved</code>.
              </li>
              <li>
                <strong>Human Escape Hatch:</strong> Every auto-reply includes explicit instructions on how the customer can request an immediate human engineer.
              </li>
              <li>
                <strong>Tenant Scoped:</strong> Generated replies strictly use solutions from the same customer account.
              </li>
            </ul>
          </div>

          {/* Confidence Threshold */}
          <div className="p-3.5 rounded-xl border border-zinc-200 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-zinc-800 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-zinc-500" />
                <span>Minimum Confidence Threshold</span>
              </label>
              <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                {Math.round(config.min_confidence * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.70"
              max="0.95"
              step="0.05"
              value={config.min_confidence}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  min_confidence: parseFloat(e.target.value),
                }))
              }
              className="w-full accent-purple-600 cursor-pointer"
            />
            <p className="text-[11px] text-zinc-500">
              Tickets classified below {Math.round(config.min_confidence * 100)}% confidence will be placed directly in the human queue without auto-replying.
            </p>
          </div>

          {/* Allowed Categories */}
          <div className="p-3.5 rounded-xl border border-zinc-200 bg-white space-y-2.5">
            <span className="font-semibold text-zinc-800 block">
              Allowed Categories for Auto-Reply:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Duplicate Question */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.allowed_categories.includes('duplicate_question')}
                  onChange={() => handleCategoryToggle('duplicate_question')}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-medium text-zinc-800">Duplicate Questions</span>
              </label>

              {/* Feature Request */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.allowed_categories.includes('feature_request')}
                  onChange={() => handleCategoryToggle('feature_request')}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-medium text-zinc-800">Feature Requests</span>
              </label>

              {/* Billing - Permanently Locked */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-zinc-200 bg-zinc-100/70 text-zinc-400">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="font-medium">Billing & Invoices</span>
                </div>
                <Badge variant="outline" className="text-[9px] bg-white">
                  Mandatory Human
                </Badge>
              </div>

              {/* Bug - Permanently Locked */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-zinc-200 bg-zinc-100/70 text-zinc-400">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="font-medium">Bugs & Incidents</span>
                </div>
                <Badge variant="outline" className="text-[9px] bg-white">
                  Mandatory Human
                </Badge>
              </div>
            </div>
          </div>

          {statusMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs font-medium ${
                statusMsg.isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Configuration
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
