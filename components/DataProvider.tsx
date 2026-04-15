"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  customers as seedCustomers,
  tickets as seedTickets,
  seedNotifications,
  seedCannedResponses,
  defaultEscalationSettings,
} from "@/lib/data";
import type {
  Customer, Ticket, AppNotification, CannedResponse, EscalationSettings,
} from "@/lib/data";

const CURRENT_AGENT = "Sarah K.";

interface DataContextType {
  tickets: Ticket[];
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  notifications: AppNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;
  cannedResponses: CannedResponse[];
  setCannedResponses: React.Dispatch<React.SetStateAction<CannedResponse[]>>;
  escalationSettings: EscalationSettings;
  setEscalationSettings: React.Dispatch<React.SetStateAction<EscalationSettings>>;
  resetData: () => void;
  hydrated: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

function nowLabel() {
  const n = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[n.getMonth()]} ${n.getDate()}, ${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}

function parseCreatedMs(created: string): number {
  try {
    const m = created.match(/^(\w{3})\s+(\d+),\s+(\d{2}):(\d{2})$/);
    if (!m) return 0;
    const months: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const d = new Date(new Date().getFullYear(), months[m[1]], +m[2], +m[3], +m[4]);
    if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
    return d.getTime();
  } catch { return 0; }
}

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const [tickets, setTickets]                     = useState<Ticket[]>(seedTickets);
  const [customers, setCustomers]                 = useState<Customer[]>(seedCustomers);
  const [notifications, setNotifications]         = useState<AppNotification[]>(seedNotifications);
  const [cannedResponses, setCannedResponses]     = useState<CannedResponse[]>(seedCannedResponses);
  const [escalationSettings, setEscalationSettings] = useState<EscalationSettings>(defaultEscalationSettings);
  const [hydrated, setHydrated]                   = useState(false);

  // ── Hydrate from localStorage ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const t  = localStorage.getItem("crm-tickets");
      const c  = localStorage.getItem("crm-customers");
      const n  = localStorage.getItem("crm-notifications");
      const cr = localStorage.getItem("crm-canned");
      const es = localStorage.getItem("crm-escalation");
      if (t)  setTickets(JSON.parse(t));
      if (c)  setCustomers(JSON.parse(c));
      if (n)  setNotifications(JSON.parse(n));
      if (cr) setCannedResponses(JSON.parse(cr));
      if (es) setEscalationSettings(JSON.parse(es));
    } catch {}
    setHydrated(true);
  }, []);

  // ── Persist to localStorage ────────────────────────────────────────────────
  useEffect(() => { if (hydrated) localStorage.setItem("crm-tickets",       JSON.stringify(tickets));              }, [tickets, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("crm-customers",     JSON.stringify(customers));            }, [customers, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("crm-notifications", JSON.stringify(notifications));        }, [notifications, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("crm-canned",        JSON.stringify(cannedResponses));      }, [cannedResponses, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("crm-escalation",    JSON.stringify(escalationSettings));   }, [escalationSettings, hydrated]);

  // ── SLA breach & auto-escalation checker (runs every 60s) ─────────────────
  useEffect(() => {
    if (!hydrated) return;
    const check = () => {
      const now = Date.now();
      setTickets(prev => {
        let changed = false;
        const updated = prev.map(t => {
          if (t.status === "Resolved" || t.status === "On Hold" || t.escalated) return t;
          const ageMs = now - parseCreatedMs(t.created);
          const ageHours = ageMs / 3_600_000;

          // SLA breach notification (>30 min, fire once by checking if already notified)
          const ageMin = ageMs / 60_000;
          if (ageMin > 30) {
            setNotifications(ns => {
              if (ns.some(n => n.ticketId === t.id && n.type === "sla_breach")) return ns;
              return [{
                id: `n-sla-${t.id}`,
                type: "sla_breach" as const,
                ticketId: t.id,
                message: `${t.id} has breached SLA — ${t.agent === "Unassigned" ? "unassigned" : `assigned to ${t.agent}`}`,
                timestamp: nowLabel(),
                read: false,
              }, ...ns];
            });
          }

          // Auto-escalation
          if (escalationSettings.enabled && ageHours >= escalationSettings.thresholdHours && !t.escalated) {
            changed = true;
            const escalatedTo = escalationSettings.tier2Agent;
            setNotifications(ns => {
              if (ns.some(n => n.ticketId === t.id && n.type === "escalated")) return ns;
              return [{
                id: `n-esc-${t.id}`,
                type: "escalated" as const,
                ticketId: t.id,
                message: `${t.id} auto-escalated to ${escalatedTo} after ${escalationSettings.thresholdHours}h`,
                timestamp: nowLabel(),
                read: false,
              }, ...ns];
            });
            return {
              ...t,
              escalated: true,
              escalatedAt: nowLabel(),
              escalatedTo,
              agent: escalatedTo,
              notes: [...(t.notes ?? []), {
                id: `esc-${Date.now()}`,
                author: "System",
                text: `Auto-escalated to ${escalatedTo} after ${escalationSettings.thresholdHours}h without resolution.`,
                timestamp: nowLabel(),
              }],
            };
          }
          return t;
        });
        return changed ? updated : prev;
      });
    };

    check(); // run immediately on hydration
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [hydrated, escalationSettings]);

  // ── Notification helpers ───────────────────────────────────────────────────
  const addNotification = useCallback((n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    setNotifications(prev => [{
      ...n,
      id: `n-${Date.now()}`,
      timestamp: nowLabel(),
      read: false,
    }, ...prev]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const resetData = useCallback(() => {
    ["crm-tickets","crm-customers","crm-notifications","crm-canned","crm-escalation"]
      .forEach(k => localStorage.removeItem(k));
    setTickets(seedTickets);
    setCustomers(seedCustomers);
    setNotifications(seedNotifications);
    setCannedResponses(seedCannedResponses);
    setEscalationSettings(defaultEscalationSettings);
  }, []);

  return (
    <DataContext.Provider value={{
      tickets, setTickets,
      customers, setCustomers,
      notifications, setNotifications, addNotification, unreadCount, markAllRead, clearNotifications,
      cannedResponses, setCannedResponses,
      escalationSettings, setEscalationSettings,
      resetData, hydrated,
    }}>
      {children}
    </DataContext.Provider>
  );
}
