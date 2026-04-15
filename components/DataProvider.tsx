"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  collection, doc, onSnapshot, writeBatch, setDoc, query, where, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";
import { defaultEscalationSettings } from "@/lib/data";
import type {
  Customer, Ticket, AppNotification, CannedResponse, EscalationSettings, AuditEntry,
} from "@/lib/data";

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
  hydrated: boolean;
  messagesUnreadCount: number;
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

// Use ISO timestamp when available for accurate cross-timezone SLA calculations
function ticketAgeMs(t: { created: string; createdAt?: string }, now: number): number {
  if (t.createdAt) {
    const d = new Date(t.createdAt);
    return isNaN(d.getTime()) ? 0 : now - d.getTime();
  }
  return now - parseCreatedMs(t.created);
}

// Diff two arrays and write only changed/new/deleted docs to Firestore
// keyFn extracts the Firestore doc ID from an item (default: item.id)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncDocs<T>(collName: string, prev: T[], next: T[], keyFn: (item: T) => string = (i: any) => i.id) {
  const prevMap = new Map(prev.map(d => [keyFn(d), JSON.stringify(d)]));
  const nextMap = new Map(next.map(d => [keyFn(d), d]));
  const batch = writeBatch(db);
  let ops = 0;

  nextMap.forEach((item, id) => {
    if (prevMap.get(id) !== JSON.stringify(item)) {
      batch.set(doc(db, collName, id), item as object);
      ops++;
    }
  });
  prevMap.forEach((_, id) => {
    if (!nextMap.has(id)) {
      batch.delete(doc(db, collName, id));
      ops++;
    }
  });
  if (ops > 0) await batch.commit();
}

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [tickets,            _setTickets]            = useState<Ticket[]>([]);
  const [customers,          _setCustomers]          = useState<Customer[]>([]);
  const [notifications,      _setNotifications]      = useState<AppNotification[]>([]);
  const [cannedResponses,    _setCannedResponses]    = useState<CannedResponse[]>([]);
  const [escalationSettings, _setEscalationSettings] = useState<EscalationSettings>(defaultEscalationSettings);
  const [hydrated,           setHydrated]            = useState(false);
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);

  // Refs for synchronous access in async callbacks and the SLA checker
  const ticketsRef   = useRef<Ticket[]>([]);
  const customersRef = useRef<Customer[]>([]);
  const notifsRef    = useRef<AppNotification[]>([]);
  const cannedRef    = useRef<CannedResponse[]>([]);
  const escalRef     = useRef<EscalationSettings>(defaultEscalationSettings);

  // ── Wrapped setters: update React state + sync delta to Firestore ──────────
  const setTickets: React.Dispatch<React.SetStateAction<Ticket[]>> = useCallback((action) => {
    _setTickets(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      syncDocs("tickets", prev, next).catch(console.error);
      ticketsRef.current = next;
      return next;
    });
  }, []);

  const setCustomers: React.Dispatch<React.SetStateAction<Customer[]>> = useCallback((action) => {
    _setCustomers(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      syncDocs("customers", prev, next, c => c.clientId).catch(console.error);
      customersRef.current = next;
      return next;
    });
  }, []);

  const setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>> = useCallback((action) => {
    _setNotifications(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      syncDocs("notifications", prev, next).catch(console.error);
      notifsRef.current = next;
      return next;
    });
  }, []);

  const setCannedResponses: React.Dispatch<React.SetStateAction<CannedResponse[]>> = useCallback((action) => {
    _setCannedResponses(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      syncDocs("cannedResponses", prev, next).catch(console.error);
      cannedRef.current = next;
      return next;
    });
  }, []);

  const setEscalationSettings: React.Dispatch<React.SetStateAction<EscalationSettings>> = useCallback((action) => {
    _setEscalationSettings(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      setDoc(doc(db, "settings", "escalation"), next).catch(console.error);
      escalRef.current = next;
      return next;
    });
  }, []);

  // ── Firestore listeners: seed once on first login, then stream live ────────
  useEffect(() => {
    if (!user) {
      _setTickets([]);
      _setCustomers([]);
      _setNotifications([]);
      _setCannedResponses([]);
      _setEscalationSettings(defaultEscalationSettings);
      ticketsRef.current   = [];
      customersRef.current = [];
      notifsRef.current    = [];
      cannedRef.current    = [];
      escalRef.current     = defaultEscalationSettings;
      setHydrated(false);
      return;
    }

    const uid = user.uid;
    const loaded = { tickets: false, customers: false, notifs: false, canned: false, escalation: false };
    function markLoaded(key: keyof typeof loaded) {
      loaded[key] = true;
      if (loaded.tickets && loaded.customers && loaded.notifs && loaded.canned && loaded.escalation) {
        setHydrated(true);
      }
    }

    const unsubTickets = onSnapshot(query(collection(db, "tickets"), limit(500)), snap => {
      const docs = snap.docs.map(d => d.data() as Ticket);
      _setTickets(docs); ticketsRef.current = docs; markLoaded("tickets");
    });

    const unsubCustomers = onSnapshot(query(collection(db, "customers"), limit(1000)), snap => {
      const docs = snap.docs.map(d => d.data() as Customer);
      _setCustomers(docs); customersRef.current = docs; markLoaded("customers");
    });

    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), limit(100)), snap => {
      const docs = snap.docs.map(d => d.data() as AppNotification);
      _setNotifications(docs); notifsRef.current = docs; markLoaded("notifs");
    });

    const unsubCanned = onSnapshot(collection(db, "cannedResponses"), snap => {
      const docs = snap.docs.map(d => d.data() as CannedResponse);
      _setCannedResponses(docs); cannedRef.current = docs; markLoaded("canned");
    });

    const unsubEscalation = onSnapshot(doc(db, "settings", "escalation"), async snap => {
      if (!snap.exists()) {
        await setDoc(doc(db, "settings", "escalation"), defaultEscalationSettings);
        markLoaded("escalation");
        return;
      }
      const data = snap.data() as EscalationSettings;
      _setEscalationSettings(data); escalRef.current = data; markLoaded("escalation");
    });

    const unsubConversations = onSnapshot(
      query(collection(db, "conversations"), where("participants", "array-contains", uid)),
      snap => {
        let total = 0;
        snap.docs.forEach(d => { total += (d.data().unread?.[uid] as number) ?? 0; });
        setMessagesUnreadCount(total);
      }
    );

    return () => {
      unsubTickets(); unsubCustomers(); unsubNotifs();
      unsubCanned(); unsubEscalation(); unsubConversations();
    };
  }, [user]);

  // ── SLA breach & auto-escalation checker (runs every 60s) ─────────────────
  useEffect(() => {
    if (!hydrated) return;

    const check = () => {
      const now = Date.now();
      setTickets(prev => {
        let changed = false;
        const updated = prev.map(t => {
          if (t.status === "Resolved" || t.status === "On Hold" || t.escalated) return t;
          const ageMs    = ticketAgeMs(t, now);
          const ageHours = ageMs / 3_600_000;
          const ageMin   = ageMs / 60_000;

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

          if (escalRef.current.enabled && ageHours >= escalRef.current.thresholdHours && !t.escalated) {
            changed = true;
            const escalatedTo = escalRef.current.tier2Agent;
            setNotifications(ns => {
              if (ns.some(n => n.ticketId === t.id && n.type === "escalated")) return ns;
              return [{
                id: `n-esc-${t.id}`,
                type: "escalated" as const,
                ticketId: t.id,
                message: `${t.id} auto-escalated to ${escalatedTo} after ${escalRef.current.thresholdHours}h`,
                timestamp: nowLabel(),
                read: false,
              }, ...ns];
            });
            const auditEntry: AuditEntry = {
              id: `audit-esc-${t.id}-${Date.now()}`,
              action: "escalated",
              from: t.agent,
              to: escalatedTo,
              author: "System",
              timestamp: nowLabel(),
            };
            return {
              ...t,
              escalated: true,
              escalatedAt: nowLabel(),
              escalatedTo,
              agent: escalatedTo,
              notes: [...(t.notes ?? []), {
                id: `esc-${Date.now()}`,
                author: "System",
                text: `Auto-escalated to ${escalatedTo} after ${escalRef.current.thresholdHours}h without resolution.`,
                timestamp: nowLabel(),
              }],
              auditLog: [auditEntry, ...(t.auditLog ?? [])],
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
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notification helpers ───────────────────────────────────────────────────
  const addNotification = useCallback((n: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    setNotifications(prev => [{
      ...n,
      id: `n-${Date.now()}`,
      timestamp: nowLabel(),
      read: false,
    }, ...prev]);
  }, [setNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [setNotifications]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, [setNotifications]);


  return (
    <DataContext.Provider value={{
      tickets,      setTickets,
      customers,    setCustomers,
      notifications, setNotifications, addNotification, unreadCount, markAllRead, clearNotifications,
      cannedResponses, setCannedResponses,
      escalationSettings, setEscalationSettings,
      hydrated, messagesUnreadCount,
    }}>
      {children}
    </DataContext.Provider>
  );
}
