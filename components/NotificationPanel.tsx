"use client";

import { useEffect, useRef } from "react";
import { X, Bell, AlertTriangle, UserCheck, ArrowUpCircle, Ticket, RefreshCw, CheckCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useData } from "./DataProvider";
import type { NotificationType } from "@/lib/data";

interface Props {
  open: boolean;
  onClose: () => void;
}

const typeIcon: Record<NotificationType, React.ReactNode> = {
  assigned:      <UserCheck    size={14} className="text-blue-500" />,
  sla_breach:    <AlertTriangle size={14} className="text-red-500" />,
  escalated:     <ArrowUpCircle size={14} className="text-amber-500" />,
  new_ticket:    <Ticket        size={14} className="text-purple-500" />,
  status_change: <RefreshCw    size={14} className="text-emerald-500" />,
};

const typeBg: Record<NotificationType, string> = {
  assigned:      "bg-blue-50",
  sla_breach:    "bg-red-50",
  escalated:     "bg-amber-50",
  new_ticket:    "bg-purple-50",
  status_change: "bg-emerald-50",
};

export default function NotificationPanel({ open, onClose }: Props) {
  const { notifications, setNotifications, markAllRead, clearNotifications, unreadCount } = useData();
  const router  = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function handleClick(ticketId: string, id: string) {
    markRead(id);
    onClose();
    router.push(`/tickets?open=${ticketId}`);
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop — subtle */}
      <div className="fixed inset-0 z-[90]" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full sm:w-[380px] z-[91] flex flex-col slide-in"
        style={{
          background: "var(--surface-lowest)",
          boxShadow: "-8px 0 48px rgba(26,28,28,0.14)",
          borderLeft: "1px solid rgba(204,195,215,0.15)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(204,195,215,0.12)", background: "var(--surface-low)" }}>
          <div className="flex items-center gap-2.5">
            <Bell size={16} className="text-[#48484a]" />
            <h2 className="text-base font-semibold text-[#1a1c1c]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold gradient-primary text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button onClick={markAllRead} title="Mark all read"
                className="flex items-center gap-1.5 text-xs text-[#48484a] hover:text-purple-600 transition-colors px-2 py-1 rounded-lg hover:bg-purple-50">
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearNotifications} title="Clear all"
                className="w-10 h-10 flex items-center justify-center rounded-xl text-[#48484a] hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={15} />
              </button>
            )}
            {/* Large touch target for iOS */}
            <button onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-[#48484a] hover:bg-[#f3f3f3] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center mb-3 opacity-60">
                <Bell size={20} className="text-white" />
              </div>
              <p className="text-sm font-medium text-[#1a1c1c] mb-1">All caught up</p>
              <p className="text-xs text-[#48484a]">No notifications yet. They'll appear here when tickets are assigned, escalated or breach SLA.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: "rgba(204,195,215,0.08)" }}>
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.ticketId, n.id)}
                  className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-all hover:bg-[rgba(113,49,214,0.03)] ${!n.read ? "bg-[rgba(113,49,214,0.02)]" : ""}`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${typeBg[n.type]}`}>
                    {typeIcon[n.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug mb-0.5 ${n.read ? "text-[#48484a]" : "text-[#1a1c1c] font-medium"}`}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-purple-600">{n.ticketId}</span>
                      <span className="text-xs text-[#48484a]">· {n.timestamp}</span>
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full gradient-primary flex-shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center px-5 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(204,195,215,0.12)", background: "var(--surface-low)" }}>
          <p className="text-xs text-[#48484a]">{notifications.length} notification{notifications.length !== 1 ? "s" : ""} · Click any to open ticket</p>
        </div>
      </div>
    </>
  );
}
