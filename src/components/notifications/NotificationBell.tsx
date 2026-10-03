'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getStaffNotifications, StaffNotificationItem } from '@/actions/ticketActions';
import { Bell, Lock, UserCheck, AlertTriangle, Check, RefreshCw } from 'lucide-react';

interface NotificationBellProps {
  userRole?: string;
}

export function NotificationBell({ userRole }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<StaffNotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read status from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('support_staff_read_notifs');
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifs = async () => {
    setIsLoading(true);
    try {
      const data = await getStaffNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem('support_staff_read_notifs', JSON.stringify(Array.from(allIds)));
    } catch {
      // ignore
    }
  };

  const markAsRead = (id: string) => {
    const updated = new Set(readIds);
    updated.add(id);
    setReadIds(updated);
    try {
      localStorage.setItem('support_staff_read_notifs', JSON.stringify(Array.from(updated)));
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const hasUrgent = notifications.some((n) => !readIds.has(n.id) && n.isUrgent);

  const getIcon = (type: StaffNotificationItem['type']) => {
    switch (type) {
      case 'internal_note':
        return <Lock className="h-4 w-4 text-amber-600" />;
      case 'assignment':
        return <UserCheck className="h-4 w-4 text-blue-600" />;
      case 'urgent_unassigned':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifs();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none transition-colors"
        aria-label="Staff Notifications"
        title="Staff Notifications & Handoffs"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-xs ${
              hasUrgent ? 'bg-red-600 animate-pulse' : 'bg-blue-600'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-zinc-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-900">Notifications</span>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                  {unreadCount} new
                </span>
              ) : (
                <span className="text-xs text-zinc-400">Caught up</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchNotifs}
                className="text-zinc-400 hover:text-zinc-600 transition-colors p-1"
                title="Refresh"
                disabled={isLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List of items */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-100">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-zinc-500">
                <Bell className="mx-auto h-6 w-6 text-zinc-300 mb-2" />
                No pending notifications or urgent alerts.
              </div>
            ) : (
              notifications.map((item) => {
                const isRead = readIds.has(item.id);

                return (
                  <Link
                    key={item.id}
                    href={`/agent/${item.ticketId}`}
                    onClick={() => {
                      markAsRead(item.id);
                      setIsOpen(false);
                    }}
                    className={`block p-3.5 transition-colors hover:bg-zinc-50 ${
                      !isRead ? 'bg-blue-50/20' : 'bg-white opacity-85'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          item.type === 'internal_note'
                            ? 'bg-amber-100'
                            : item.type === 'assignment'
                            ? 'bg-blue-100'
                            : 'bg-red-100'
                        }`}
                      >
                        {getIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-xs font-semibold truncate ${
                              !isRead ? 'text-zinc-900' : 'text-zinc-700'
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.isUrgent && (
                            <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.2 text-[10px] font-bold text-red-700">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                        <span className="text-[10px] text-zinc-400 font-mono block">
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {!isRead && (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2.5 text-center">
            <Link
              href="/agent"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900"
            >
              Go to Unified Support Queue &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
