"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  collection, doc, onSnapshot, writeBatch, setDoc, query, where, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";
import { defaultEscalationSettings, defaultSLAPolicies, defaultAutomations } from "@/lib/data";
import type {
  Customer, Ticket, AppNotification, CannedResponse,
  EscalationSettings, SLAPolicies, AutomationRule, AuditEntry,
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
  slaPolicy: SLAPolicies;
  setSlaPolicy: React.Dispatch<React.SetStateAction<SLAPolicies>>;
  automations: AutomationRule[];
  setAutomations: React.Dispatch<React.SetStateAction<AutomationRule[]>>;
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
  const [slaPolicy,          _setSlaPolicy]          = useState<SLAPolicies>(defaultSLAPolicies);
  const [automations,        _setAutomations]        = useState<AutomationRule[]>(defaultAutomations);
  const [hydrated,           setHydrated]            = useState(false);
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);

  // Refs for synchronous access in async callbacks and the SLA checker
  const ticketsRef   = useRef<Ticket[]>([]);
  const customersRef = useRef<Customer[]>([]);
  const notifsRef    = useRef<AppNotification[]>([]);
  const cannedRef    = useRef<CannedResponse[]>([]);
  const escalRef          = useRef<EscalationSettings>(defaultEscalationSettings);
  const slaRef            = useRef<SLAPolicies>(defaultSLAPolicies);
  const automationsRef    = useRef<AutomationRule[]>(defaultAutomations);
  const agentNamesRef     = useRef<string[]>([]);
  // Tracks rule+ticket combos already acted on this session — prevents re-firing every 60 s
  const firedAutomations  = useRef<Set<string>>(new Set());

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

  const setSlaPolicy: React.Dispatch<React.SetStateAction<SLAPolicies>> = useCallback((action) => {
    _setSlaPolicy(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      setDoc(doc(db, "settings", "sla"), next).catch(console.error);
      slaRef.current = next;
      return next;
    });
  }, []);

  const setAutomations: React.Dispatch<React.SetStateAction<AutomationRule[]>> = useCallback((action) => {
    _setAutomations(prev => {
      const next = typeof action === "function" ? action(prev) : action;
      setDoc(doc(db, "settings", "automations"), { rules: next }).catch(console.error);
      automationsRef.current = next;
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
      _setSlaPolicy(defaultSLAPolicies);
      _setAutomations(defaultAutomations);
      slaRef.current = defaultSLAPolicies;
      automationsRef.current = defaultAutomations;
      firedAutomations.current.clear();
      ticketsRef.current   = [];
      customersRef.current = [];
      notifsRef.current    = [];
      cannedRef.current    = [];
      escalRef.current     = defaultEscalationSettings;
      setHydrated(false);
      return;
    }

    const uid = user.uid;
    const loaded = { tickets: false, customers: false, notifs: false, canned: false, escalation: false, sla: false, automations: false };
    function markLoaded(key: keyof typeof loaded) {
      loaded[key] = true;
      if (Object.values(loaded).every(Boolean)) setHydrated(true);
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

    const unsubSla = onSnapshot(doc(db, "settings", "sla"), async snap => {
      if (!snap.exists()) {
        await setDoc(doc(db, "settings", "sla"), defaultSLAPolicies);
        markLoaded("sla");
        return;
      }
      const data = snap.data() as SLAPolicies;
      _setSlaPolicy(data); slaRef.current = data; markLoaded("sla");
    });

    const unsubAutomations = onSnapshot(doc(db, "settings", "automations"), async snap => {
      if (!snap.exists()) {
        await setDoc(doc(db, "settings", "automations"), { rules: defaultAutomations });
        markLoaded("automations");
        return;
      }
      const rules = (snap.data().rules ?? defaultAutomations) as AutomationRule[];
      _setAutomations(rules); automationsRef.current = rules; markLoaded("automations");
    });

    // Keep an up-to-date agent name list for round-robin assignment
    const unsubUsers = onSnapshot(collection(db, "users"), snap => {
      agentNamesRef.current = snap.docs.map(d => d.data().name as string).filter(Boolean);
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
      unsubCanned(); unsubEscalation(); unsubSla();
      unsubAutomations(); unsubUsers(); unsubConversations();
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

          // Per-priority SLA breach detection
          const policy = slaRef.current[t.priority as keyof typeof slaRef.current];
          const slaTargetMs = t.status === "Open"
            ? policy.firstReplyMinutes * 60_000
            : policy.resolutionMinutes * 60_000;

          if (ageMs > slaTargetMs) {
            setNotifications(ns => {
              if (ns.some(n => n.ticketId === t.id && n.type === "sla_breach")) return ns;
              const breachType = t.status === "Open" ? "first reply" : "resolution";
              return [{
                id: `n-sla-${t.id}`,
                type: "sla_breach" as const,
                ticketId: t.id,
                message: `${t.id} has breached ${breachType} SLA — ${t.agent === "Unassigned" ? "unassigned" : `assigned to ${t.agent}`}`,
                timestamp: nowLabel(),
                read: false,
              }, ...ns];
            });
          }

          if (escalRef.current.enabled && ageHours >= escalRef.current.thresholdHours && !t.escalated) {
            changed = true;
            const escalatedTo = escalRef.current.tier2Agent;
            // Never reassign if a human explicitly set the agent (manualAgent flag),
            // and only hand off to tier-2 if still unassigned.
            const alreadyAssigned = t.agent !== "Unassigned" || t.manualAgent === true;
            const newAgent = alreadyAssigned ? t.agent : escalatedTo;
            const noteText = alreadyAssigned
              ? `Escalated flag set after ${escalRef.current.thresholdHours}h — ticket remains with ${t.agent}.`
              : `Auto-escalated to ${escalatedTo} after ${escalRef.current.thresholdHours}h without resolution.`;
            setNotifications(ns => {
              if (ns.some(n => n.ticketId === t.id && n.type === "escalated")) return ns;
              return [{
                id: `n-esc-${t.id}`,
                type: "escalated" as const,
                ticketId: t.id,
                message: alreadyAssigned
                  ? `${t.id} SLA escalation flagged — assigned to ${t.agent}`
                  : `${t.id} auto-escalated to ${escalatedTo} after ${escalRef.current.thresholdHours}h`,
                timestamp: nowLabel(),
                read: false,
              }, ...ns];
            });
            const auditEntry: AuditEntry = {
              id: `audit-esc-${t.id}-${Date.now()}`,
              action: "escalated",
              from: t.agent,
              to: newAgent,
              author: "System",
              timestamp: nowLabel(),
            };
            return {
              ...t,
              escalated: true,
              escalatedAt: nowLabel(),
              escalatedTo,
              agent: newAgent,
              notes: [...(t.notes ?? []), {
                id: `esc-${Date.now()}`,
                author: "System",
                text: noteText,
                timestamp: nowLabel(),
              }],
              auditLog: [auditEntry, ...(t.auditLog ?? [])],
            };
          }
          return t;
        });
        return changed ? updated : prev;
      });

      // ── Automation rule engine ───────────────────────────────────────────────
      const activeRules = automationsRef.current.filter(r => r.enabled);
      if (activeRules.length === 0) return;

      setTickets(prev => {
        let changed = false;
        const updated = prev.map(t => {
          if (t.status === "Resolved" || t.status === "On Hold") return t;
          const ageMin = ticketAgeMs(t, now) / 60_000;
          let ticket = { ...t };

          for (const rule of activeRules) {
            const firedKey = `${rule.id}:${t.id}`;

            // Evaluate ALL conditions (AND logic)
            const conditionsMet = rule.conditions.every(cond => {
              const val = cond.value;
              switch (cond.field) {
                case "age_minutes": {
                  const n = Number(val);
                  if (cond.operator === "greater_than") return ageMin > n;
                  if (cond.operator === "less_than")    return ageMin < n;
                  return Math.floor(ageMin) === n;
                }
                case "agent":
                  return cond.operator === "equals"     ? ticket.agent    === val
                       : cond.operator === "not_equals" ? ticket.agent    !== val
                       : false;
                case "status":
                  return cond.operator === "equals"     ? ticket.status   === val
                       : cond.operator === "not_equals" ? ticket.status   !== val
                       : false;
                case "priority":
                  return cond.operator === "equals"     ? ticket.priority === val
                       : cond.operator === "not_equals" ? ticket.priority !== val
                       : false;
                default: return false;
              }
            });

            if (!conditionsMet) continue;

            // Execute actions
            for (const action of rule.actions) {
              if (action.type === "assign_agent") {
                // Data-level guard: skip if already assigned OR if a human explicitly set the agent
                if (ticket.agent !== "Unassigned" || ticket.manualAgent) { firedAutomations.current.add(firedKey); continue; }
                if (firedAutomations.current.has(firedKey)) continue;
                let assignTo = action.value;
                if (assignTo === "round_robin") {
                  const agents = agentNamesRef.current;
                  if (agents.length === 0) continue;
                  // Pick agent with fewest open tickets
                  const counts = new Map(agents.map(a => [a, 0]));
                  prev.forEach(tk => {
                    if (tk.status !== "Resolved" && tk.agent !== "Unassigned" && counts.has(tk.agent)) {
                      counts.set(tk.agent, (counts.get(tk.agent) ?? 0) + 1);
                    }
                  });
                  let min = Infinity;
                  counts.forEach((c, a) => { if (c < min) { min = c; assignTo = a; } });
                }
                if (assignTo && assignTo !== "round_robin") {
                  const auditEntry: AuditEntry = {
                    id: `audit-auto-${t.id}-${Date.now()}`,
                    action: "agent_changed",
                    from: ticket.agent,
                    to: assignTo,
                    author: "Automation",
                    timestamp: nowLabel(),
                  };
                  ticket = {
                    ...ticket,
                    agent: assignTo,
                    auditLog: [auditEntry, ...(ticket.auditLog ?? [])],
                  };
                  changed = true;
                  firedAutomations.current.add(firedKey);
                  setNotifications(ns => {
                    if (ns.some(n => n.id === `n-auto-assign-${t.id}`)) return ns;
                    return [{
                      id: `n-auto-assign-${t.id}`,
                      type: "assigned" as const,
                      ticketId: t.id,
                      message: `${t.id} auto-assigned to ${assignTo} by rule "${rule.name}"`,
                      timestamp: nowLabel(),
                      read: false,
                    }, ...ns];
                  });
                }
              }

              if (action.type === "notify") {
                if (firedAutomations.current.has(firedKey)) continue;
                const msg = action.value.replace("{{ticket_id}}", t.id);
                setNotifications(ns => {
                  if (ns.some(n => n.id === `n-auto-${rule.id}-${t.id}`)) return ns;
                  return [{
                    id: `n-auto-${rule.id}-${t.id}`,
                    type: "sla_breach" as const,
                    ticketId: t.id,
                    message: msg,
                    timestamp: nowLabel(),
                    read: false,
                  }, ...ns];
                });
                firedAutomations.current.add(firedKey);
              }

              if (action.type === "change_status") {
                // Data-level guard: skip if already in target status
                if (ticket.status === action.value) { firedAutomations.current.add(firedKey); continue; }
                if (firedAutomations.current.has(firedKey)) continue;
                const auditEntry: AuditEntry = {
                  id: `audit-auto-status-${t.id}-${Date.now()}`,
                  action: "status_changed",
                  from: ticket.status,
                  to: action.value,
                  author: "Automation",
                  timestamp: nowLabel(),
                };
                ticket = {
                  ...ticket,
                  status: action.value as Ticket["status"],
                  auditLog: [auditEntry, ...(ticket.auditLog ?? [])],
                };
                changed = true;
                firedAutomations.current.add(firedKey);
              }
            }
          }
          return changed ? ticket : t;
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
      slaPolicy, setSlaPolicy,
      automations, setAutomations,
      hydrated, messagesUnreadCount,
    }}>
      {children}
    </DataContext.Provider>
  );
}
