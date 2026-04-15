"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  collection, doc, onSnapshot, writeBatch, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";
import {
  customers as seedCustomers,
  tickets as seedTickets,
  seedNotifications,
  seedCannedResponses,
  defaultEscalationSettings,
} from "@/lib/data";
import type {
  Customer, Ticket, AppNotification, CannedResponse, EscalationSettings, AuditEntry,
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

  // ── Firestore listeners: seed if empty, then stream live updates ──────────
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

    // Track which collections have fired at least one non-seeding snapshot
    const loaded = { tickets: false, customers: false, notifs: false, canned: false, escalation: false };
    function markLoaded(key: keyof typeof loaded) {
      loaded[key] = true;
      if (loaded.tickets && loaded.customers && loaded.notifs && loaded.canned && loaded.escalation) {
        setHydrated(true);
      }
    }

    // Track whether we've triggered seeding (prevents duplicate seed on rapid empty snapshots)
    const seeded = { tickets: false, customers: false, notifs: false, canned: false };

    async function seedCollection<T extends { id: string }>(collName: string, items: T[]) {
      const batch = writeBatch(db);
      items.forEach(item => batch.set(doc(db, collName, item.id), item as object));
      await batch.commit();
    }

    const unsubTickets = onSnapshot(collection(db, "tickets"), async snap => {
      if (snap.empty && !seeded.tickets) {
        seeded.tickets = true;
        await seedCollection("tickets", seedTickets);
        return; // onSnapshot will fire again after seed
      }
      const docs = snap.docs.map(d => d.data() as Ticket);
      _setTickets(docs);
      ticketsRef.current = docs;
      markLoaded("tickets");
    });

    const unsubCustomers = onSnapshot(collection(db, "customers"), async snap => {
      if (snap.empty && !seeded.customers) {
        seeded.customers = true;
        // Customers use clientId as the doc ID
        const batch = writeBatch(db);
        seedCustomers.forEach(c => batch.set(doc(db, "customers", c.clientId), c as object));
        await batch.commit();
        return;
      }
      const docs = snap.docs.map(d => d.data() as Customer);
      _setCustomers(docs);
      customersRef.current = docs;
      markLoaded("customers");
    });

    const unsubNotifs = onSnapshot(collection(db, "notifications"), async snap => {
      if (snap.empty && !seeded.notifs) {
        seeded.notifs = true;
        await seedCollection("notifications", seedNotifications);
        return;
      }
      const docs = snap.docs.map(d => d.data() as AppNotification);
      _setNotifications(docs);
      notifsRef.current = docs;
      markLoaded("notifs");
    });

    const unsubCanned = onSnapshot(collection(db, "cannedResponses"), async snap => {
      if (snap.empty && !seeded.canned) {
        seeded.canned = true;
        await seedCollection("cannedResponses", seedCannedResponses);
        return;
      }
      const docs = snap.docs.map(d => d.data() as CannedResponse);
      _setCannedResponses(docs);
      cannedRef.current = docs;
      markLoaded("canned");
    });

    const unsubEscalation = onSnapshot(doc(db, "settings", "escalation"), async snap => {
      if (!snap.exists()) {
        await setDoc(doc(db, "settings", "escalation"), defaultEscalationSettings);
        markLoaded("escalation");
        return;
      }
      const data = snap.data() as EscalationSettings;
      _setEscalationSettings(data);
      escalRef.current = data;
      markLoaded("escalation");
    });

    return () => {
      unsubTickets();
      unsubCustomers();
      unsubNotifs();
      unsubCanned();
      unsubEscalation();
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
          const ageMs    = now - parseCreatedMs(t.created);
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

  // ── Reset: delete all docs then re-seed ───────────────────────────────────
  const resetData = useCallback(async () => {
    const deleteById = async (collName: string, ids: string[]) => {
      if (ids.length === 0) return;
      const batch = writeBatch(db);
      ids.forEach(id => batch.delete(doc(db, collName, id)));
      await batch.commit();
    };

    await deleteById("tickets",        ticketsRef.current.map(t => t.id));
    await deleteById("customers",      customersRef.current.map(c => c.clientId));
    await deleteById("notifications",  notifsRef.current.map(n => n.id));
    await deleteById("cannedResponses", cannedRef.current.map(c => c.id));

    const seedBatch = writeBatch(db);
    seedTickets.forEach(t         => seedBatch.set(doc(db, "tickets",         t.id),       t as object));
    seedCustomers.forEach(c       => seedBatch.set(doc(db, "customers",       c.clientId), c as object));
    seedNotifications.forEach(n   => seedBatch.set(doc(db, "notifications",   n.id),       n as object));
    seedCannedResponses.forEach(c => seedBatch.set(doc(db, "cannedResponses", c.id),       c as object));
    await seedBatch.commit();
    await setDoc(doc(db, "settings", "escalation"), defaultEscalationSettings);
  }, []);

  return (
    <DataContext.Provider value={{
      tickets,      setTickets,
      customers,    setCustomers,
      notifications, setNotifications, addNotification, unreadCount, markAllRead, clearNotifications,
      cannedResponses, setCannedResponses,
      escalationSettings, setEscalationSettings,
      resetData, hydrated,
    }}>
      {children}
    </DataContext.Provider>
  );
}
