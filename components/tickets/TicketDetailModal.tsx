"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, Hash, ExternalLink, Clock, MessageSquare, Send, Mail,
  ArrowUpCircle, ChevronDown, Smartphone, FileText, Check,
  RefreshCw, UserCheck, ArrowUpDown, Plus, Activity,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Ticket, TicketStatus, TicketPriority, Note, AuditEntry, AuditAction } from "@/lib/data";
import { StatusPill, PriorityPill } from "@/components/ui/StatusPill";
import { InputField, SelectField, TextareaField } from "@/components/ui/FormField";
import { useData } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";

interface Props {
  ticket: Ticket | null;
  onClose: () => void;
  onSave: (updated: Ticket) => void;
}

function parseCreated(created: string): Date | null {
  try {
    const m = created.match(/^(\w{3})\s+(\d+),\s+(\d{2}):(\d{2})$/);
    if (!m) return null;
    const months: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const d = new Date(new Date().getFullYear(), months[m[1]], +m[2], +m[3], +m[4]);
    if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
    return d;
  } catch { return null; }
}

function getElapsed(created: string): string {
  const d = parseCreated(created);
  if (!d) return created;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function computeSLABadge(
  ticket: Ticket,
  status: TicketStatus,
  policy: { firstReplyMinutes: number; resolutionMinutes: number },
  now: number,
) {
  if (status === "Resolved") return { label: "Resolved", sub: "",            cls: "bg-emerald-50 text-emerald-700" };
  if (status === "On Hold")  return { label: "On Hold",  sub: "SLA paused",  cls: "bg-amber-50 text-amber-700" };

  const createdMs = ticket.createdAt
    ? new Date(ticket.createdAt).getTime()
    : (parseCreated(ticket.created)?.getTime() ?? 0);
  if (!createdMs) return { label: "—", sub: "", cls: "bg-slate-100 text-slate-500" };

  const elapsedMs   = now - createdMs;
  const isOpen      = status === "Open";
  const targetMs    = (isOpen ? policy.firstReplyMinutes : policy.resolutionMinutes) * 60_000;
  const remainingMs = targetMs - elapsedMs;
  const pctUsed     = elapsedMs / targetMs;

  const typeLabel = isOpen ? "First Reply" : "Resolution";

  if (remainingMs > 0) {
    const cls = pctUsed < 0.75
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";
    return { label: typeLabel, sub: `${formatCountdown(remainingMs)} left`, cls };
  }
  return {
    label: typeLabel,
    sub:   `Breached ${formatCountdown(remainingMs)} ago`,
    cls:   "bg-red-50 text-red-600",
  };
}

function nowLabel() {
  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[now.getMonth()]} ${now.getDate()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
}

function formatPhone(phone: string) {
  return phone.replace(/[\s+\-()]/g, "");
}

// ── SLA helpers ───────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  const totalMins = Math.floor(Math.abs(ms) / 60_000);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0)  return `${mins}m`;
  if (hrs < 24)   return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remH = hrs % 24;
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

// ── Audit entry display helpers ───────────────────────────────────────────────
const auditIconMap: Record<AuditAction, { icon: React.ReactNode; color: string; bg: string }> = {
  created:          { icon: <Plus size={11} />,         color: "text-slate-600",   bg: "bg-slate-100" },
  status_changed:   { icon: <RefreshCw size={11} />,    color: "text-emerald-600", bg: "bg-emerald-50" },
  agent_changed:    { icon: <UserCheck size={11} />,    color: "text-blue-600",    bg: "bg-blue-50" },
  priority_changed: { icon: <ArrowUpDown size={11} />,  color: "text-orange-600",  bg: "bg-orange-50" },
  escalated:        { icon: <ArrowUpCircle size={11} />,color: "text-amber-600",   bg: "bg-amber-50" },
  note_added:       { icon: <MessageSquare size={11} />,color: "text-purple-600",  bg: "bg-purple-50" },
};

function auditLabel(entry: AuditEntry): string {
  switch (entry.action) {
    case "created":          return "Ticket created";
    case "status_changed":   return `Status changed from ${entry.from} → ${entry.to}`;
    case "agent_changed":    return `Assigned to ${entry.to}${entry.from && entry.from !== "Unassigned" ? ` (was ${entry.from})` : ""}`;
    case "priority_changed": return `Priority changed from ${entry.from} → ${entry.to}`;
    case "escalated":        return `Escalated to ${entry.to}${entry.from ? ` (was ${entry.from})` : ""}`;
    case "note_added":       return "Internal note added";
    default:                 return entry.action;
  }
}

async function callSendEmail(payload: Record<string, string>) {
  try {
    const { auth } = await import("@/lib/firebase");
    const token = await auth.currentUser?.getIdToken();
    await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch { /* non-blocking */ }
}

export default function TicketDetailModal({ ticket, onClose, onSave }: Props) {
  const { cannedResponses, escalationSettings, addNotification, tickets: allTickets, customers, slaPolicy } = useData();
  const { user: currentUser } = useAuth();
  const authorName = currentUser?.name ?? "Agent";

  const [form, setForm]             = useState<Ticket | null>(null);
  const [dirty, setDirty]           = useState(false);
  const [c360Open, setC360Open]     = useState(false);
  const [slaTick,  setSlaTick]      = useState(0);
  const [noteText, setNoteText]     = useState("");
  const [replyText, setReplyText]   = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [bottomTab, setBottomTab]   = useState<"notes" | "activity">("notes");
  const templateRef = useRef<HTMLDivElement>(null);
  const replyRef    = useRef<HTMLTextAreaElement>(null);

  // Live agents from Firestore
  const [agentList, setAgentList] = useState<string[]>(["Unassigned"]);
  // Email state
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent,    setEmailSent]    = useState(false);
  const [emailError,   setEmailError]   = useState("");

  // ── Firestore: live agent list ─────────────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, "users"), snap => {
      const names = snap.docs
        .map(d => d.data().name as string)
        .filter(Boolean)
        .sort();
      setAgentList(["Unassigned", ...names]);
    });
  }, []);

  useEffect(() => {
    if (ticket) {
      setForm({ ...ticket });
      setDirty(false);
      setNoteText("");
      setReplyText("");
      setShowTemplates(false);
      setBottomTab("notes");
      setEmailError("");
      setEmailSent(false);
    }
  }, [ticket]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!showTemplates) return;
    function handler(e: MouseEvent) {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTemplates]);

  // Tick every 30s so the live SLA countdown updates
  useEffect(() => {
    const id = setInterval(() => setSlaTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!ticket || !form) return null;

  function update<K extends keyof Ticket>(key: K, value: Ticket[K]) {
    setForm(f => f ? { ...f, [key]: value } : f);
    setDirty(true);
  }

  // ── Save with audit diff ───────────────────────────────────────────────────
  function handleSave() {
    if (!form || !ticket) return;
    const ts = nowLabel();
    const newEntries: AuditEntry[] = [];

    if (form.status !== ticket.status)
      newEntries.push({ id: `a-${Date.now()}-s`,   action: "status_changed",   from: ticket.status,   to: form.status,   author: authorName, timestamp: ts });
    if (form.agent !== ticket.agent)
      newEntries.push({ id: `a-${Date.now()}-ag`,  action: "agent_changed",    from: ticket.agent,    to: form.agent,    author: authorName, timestamp: ts });
    if (form.priority !== ticket.priority)
      newEntries.push({ id: `a-${Date.now()}-p`,   action: "priority_changed", from: ticket.priority, to: form.priority, author: authorName, timestamp: ts });

    const updated: Ticket = {
      ...form,
      // Stamp firstRepliedAt the first time a ticket moves out of "Open"
      firstRepliedAt: ticket.status === "Open" && form.status !== "Open" && !form.firstRepliedAt
        ? new Date().toISOString()
        : form.firstRepliedAt,
      // Stamp resolvedAt the first time a ticket is moved to Resolved
      resolvedAt: form.status === "Resolved" && ticket.status !== "Resolved"
        ? new Date().toISOString()
        : form.resolvedAt,
      auditLog: newEntries.length
        ? [...newEntries, ...(form.auditLog ?? [])]
        : (form.auditLog ?? []),
    };
    onSave(updated);

    // Send resolution email if status just changed to Resolved and customer has email
    if (form.status === "Resolved" && ticket.status !== "Resolved" && form.email) {
      callSendEmail({
        type: "ticket_resolved",
        to: form.email,
        ticketId: form.id,
        customerName: form.customer,
      });
    }

    onClose();
  }

  function addNote() {
    if (!noteText.trim() || !form) return;
    const ts = nowLabel();
    const note: Note = { id: Date.now().toString(), author: authorName, text: noteText.trim(), timestamp: ts };
    const auditEntry: AuditEntry = { id: `a-note-${Date.now()}`, action: "note_added", author: authorName, timestamp: ts };
    const updated: Ticket = {
      ...form,
      notes: [...(form.notes ?? []), note],
      auditLog: [auditEntry, ...(form.auditLog ?? [])],
    };
    setForm(updated);
    onSave(updated);
    setNoteText("");
  }

  // ── Canned response insertion ───────────────────────────────────────────────
  function insertTemplate(id: string, body: string) {
    if (!form) return;
    const filled = body
      .replace(/\{\{customer_name\}\}/g, form.customer)
      .replace(/\{\{ticket_id\}\}/g, form.id);
    setReplyText(prev => prev ? prev + "\n\n" + filled : filled);
    setInsertedId(id);
    setShowTemplates(false);
    setTemplateSearch("");
    setTimeout(() => setInsertedId(null), 2000);
    setTimeout(() => replyRef.current?.focus(), 50);
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  function openWhatsApp() {
    if (!form || !replyText.trim()) return;
    const phone = formatPhone(form.phone);
    const text  = encodeURIComponent(replyText.trim());
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  }

  function sendReplyAsNote() {
    if (!replyText.trim() || !form) return;
    const ts = nowLabel();
    const note: Note = { id: Date.now().toString(), author: `${authorName} (reply)`, text: replyText.trim(), timestamp: ts };
    const auditEntry: AuditEntry = { id: `a-reply-${Date.now()}`, action: "note_added", author: authorName, timestamp: ts };
    const updated: Ticket = {
      ...form,
      notes: [...(form.notes ?? []), note],
      auditLog: [auditEntry, ...(form.auditLog ?? [])],
    };
    setForm(updated);
    onSave(updated);
    setReplyText("");
  }

  // ── Email reply ────────────────────────────────────────────────────────────
  async function sendReplyAsEmail() {
    if (!replyText.trim() || !form || !form.email) return;
    setEmailSending(true);
    setEmailError("");
    try {
      // Log as note first
      const ts = nowLabel();
      const note: Note = { id: Date.now().toString(), author: `${authorName} (email reply)`, text: replyText.trim(), timestamp: ts };
      const auditEntry: AuditEntry = { id: `a-email-${Date.now()}`, action: "note_added", author: authorName, timestamp: ts };
      const updated: Ticket = {
        ...form,
        notes: [...(form.notes ?? []), note],
        auditLog: [auditEntry, ...(form.auditLog ?? [])],
      };
      setForm(updated);
      onSave(updated);

      const { auth } = await import("@/lib/firebase");
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: "agent_reply",
          to: form.email,
          ticketId: form.id,
          customerName: form.customer,
          agentMessage: replyText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEmailError(data.error ?? "Failed to send email");
      } else {
        setEmailSent(true);
        setReplyText("");
        setTimeout(() => setEmailSent(false), 3000);
      }
    } catch {
      setEmailError("Network error — email not sent");
    } finally {
      setEmailSending(false);
    }
  }

  // ── Manual escalation ──────────────────────────────────────────────────────
  function handleEscalate() {
    if (!form) return;
    const to  = escalationSettings.tier2Agent;
    const ts  = nowLabel();
    const note: Note = { id: `esc-${Date.now()}`, author: authorName, text: `Manually escalated to ${to} at ${ts}.`, timestamp: ts };
    const auditEntry: AuditEntry = { id: `a-esc-${Date.now()}`, action: "escalated", from: form.agent, to, author: authorName, timestamp: ts };
    const updated: Ticket = {
      ...form,
      escalated: true,
      escalatedAt: ts,
      escalatedTo: to,
      agent: to,
      notes: [...(form.notes ?? []), note],
      auditLog: [auditEntry, ...(form.auditLog ?? [])],
    };
    setForm(updated);
    setDirty(false);
    onSave(updated);
    addNotification({ type: "escalated", ticketId: form.id, message: `${form.id} escalated to ${to} by ${authorName}` });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sla = computeSLABadge(ticket, form.status, slaPolicy[form.priority], Date.now());
  const filteredCanned = cannedResponses.filter(cr =>
    !templateSearch || cr.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
    cr.category.toLowerCase().includes(templateSearch.toLowerCase())
  );
  const categories = Array.from(new Set(filteredCanned.map(cr => cr.category)));
  const auditLog   = form.auditLog ?? [];
  const notes      = form.notes ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(26,28,28,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-2xl z-10 overflow-hidden flex flex-col"
        style={{ background: "var(--surface-lowest)", boxShadow: "0 24px 80px 0 rgba(26,28,28,0.14)", maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 flex-shrink-0" style={{ background: "var(--surface-low)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl gradient-primary flex-shrink-0">
              <Hash size={14} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-[#1a1c1c] tracking-tight">{ticket.id}</h2>
                <span className="text-xs font-medium text-[#0058bf]">{ticket.clientId}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sla.cls}`} title={`SLA: ${sla.label}`}>
                  <Clock size={10} />
                  <span>{sla.label}</span>
                  {sla.sub && <span className="opacity-80">· {sla.sub}</span>}
                </span>
                {form.escalated && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    <ArrowUpCircle size={10} /> Escalated → {form.escalatedTo}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#48484a]">Created {ticket.created} · {getElapsed(ticket.created)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!form.escalated && form.status !== "Resolved" && (
              <button onClick={handleEscalate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                style={{ background: "rgba(245,158,11,0.1)" }}>
                <ArrowUpCircle size={13} /> Escalate
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#48484a] hover:bg-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-7">

          {/* Status + Priority + Agent */}
          <div className="flex items-center gap-3 mb-6 p-4 rounded-xl" style={{ background: "var(--surface-low)" }}>
            {/* STATUS — invisible select over a pill display */}
            <div className="flex-1">
              <p className="text-label-caps text-[#48484a] mb-2">STATUS</p>
              <div className="relative">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl pointer-events-none"
                  style={{ background: "var(--surface-lowest)" }}>
                  <StatusPill status={form.status} />
                  <ChevronDown size={11} className="opacity-40 flex-shrink-0 ml-1" />
                </div>
                <select value={form.status} onChange={e => update("status", e.target.value as TicketStatus)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                  {(["Open","In Progress","On Hold","Resolved"] as TicketStatus[]).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="w-px h-10 bg-[rgba(204,195,215,0.2)]" />
            {/* PRIORITY — same pattern */}
            <div className="flex-1">
              <p className="text-label-caps text-[#48484a] mb-2">PRIORITY</p>
              <div className="relative">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl pointer-events-none"
                  style={{ background: "var(--surface-lowest)" }}>
                  <PriorityPill priority={form.priority} />
                  <ChevronDown size={11} className="opacity-40 flex-shrink-0 ml-1" />
                </div>
                <select value={form.priority} onChange={e => update("priority", e.target.value as TicketPriority)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                  {(["High","Medium","Low"] as TicketPriority[]).map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="w-px h-10 bg-[rgba(204,195,215,0.2)]" />
            <div className="flex-1">
              <SelectField label="Agent" value={form.agent} onChange={e => update("agent", e.target.value)}>
                {agentList.map(a => <option key={a}>{a}</option>)}
              </SelectField>
            </div>
          </div>

          {/* Customer 360 */}
          {(() => {
            const customer = customers.find(c => c.clientId === ticket.clientId);
            if (!customer) return null;
            const tierColors: Record<string, string> = { VIP: "bg-purple-100 text-purple-700", Premium: "bg-blue-100 text-blue-700", Standard: "bg-slate-100 text-slate-600" };
            const statusColors: Record<string, string> = { Active: "bg-emerald-50 text-emerald-700", Suspended: "bg-red-50 text-red-600", Pending: "bg-amber-50 text-amber-700" };
            const relatedTickets = allTickets
              .filter(t => t.clientId === ticket.clientId && t.id !== ticket.id)
              .slice(0, 3);
            return (
              <div className="mb-6 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(148,163,184,0.15)" }}>
                <button
                  onClick={() => setC360Open(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#f3f3f3]"
                  style={{ background: "var(--surface-low)" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg gradient-primary flex items-center justify-center">
                      <ExternalLink size={11} className="text-white" />
                    </div>
                    <span className="text-sm font-semibold text-[#1a1c1c]">Customer 360</span>
                    <span className="text-xs text-[#48484a]">{customer.name}</span>
                  </div>
                  <ChevronDown size={15} className={`text-[#48484a] transition-transform duration-200 ${c360Open ? "rotate-180" : ""}`} />
                </button>
                {c360Open && (
                  <div className="px-4 py-4" style={{ background: "var(--surface-lowest)" }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {customer.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1a1c1c]">{customer.name}</p>
                        <p className="text-xs text-[#48484a]">{customer.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {customer.accountType && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tierColors[customer.accountType] ?? "bg-slate-100 text-slate-600"}`}>
                            {customer.accountType}
                          </span>
                        )}
                        {customer.status && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[customer.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {customer.status}
                          </span>
                        )}
                      </div>
                    </div>
                    {relatedTickets.length > 0 && (
                      <div>
                        <p className="text-label-caps text-[#48484a] mb-2">Recent Tickets</p>
                        <div className="flex flex-col gap-1.5">
                          {relatedTickets.map(rt => (
                            <div key={rt.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: "var(--surface-low)" }}>
                              <span className="text-xs font-semibold text-[#0058bf] flex-shrink-0">{rt.id}</span>
                              <span className="text-xs text-[#48484a] flex-1 truncate">{rt.issue}</span>
                              <StatusPill status={rt.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {relatedTickets.length === 0 && (
                      <p className="text-xs text-[#48484a] text-center py-2">No other tickets for this customer.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Customer details */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <InputField label="Customer Name" value={form.customer} onChange={e => update("customer", e.target.value)} />
            <InputField label="Client ID"     value={form.clientId} onChange={e => update("clientId", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <InputField label="Email"        type="email" value={form.email} onChange={e => update("email", e.target.value)} />
            <InputField label="Phone Number" type="tel"   value={form.phone} onChange={e => update("phone", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <SelectField label="Issue Type" value={form.issue} onChange={e => update("issue", e.target.value)}>
              {["Withdrawal Issue","Restricted Withdrawals","Deposits","Blocked Accounts","Bet Settlement","Account Access","Bonus Dispute","Live Betting","Other"].map(o => <option key={o}>{o}</option>)}
            </SelectField>
            <div />
          </div>

          {/* Head Office Link */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#48484a] mb-1.5 uppercase tracking-wide">Head Office Ticket Link</label>
            <div className="flex gap-2 items-center">
              <input type="url" placeholder="https://headoffice.crm/tickets/..."
                value={form.headOfficeUrl ?? ""}
                onChange={e => update("headOfficeUrl", e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none transition-all focus:ring-2 focus:ring-purple-200 placeholder:text-[#48484a]"
                style={{ background: "var(--surface-low)" }}
                onFocus={e => (e.target.style.background = "var(--surface-lowest)")}
                onBlur={e => (e.target.style.background = "var(--surface-low)")} />
              {form.headOfficeUrl && (
                <a href={form.headOfficeUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity whitespace-nowrap">
                  <ExternalLink size={13} /> Open
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <TextareaField label="Description" value={form.description ?? ""} onChange={e => update("description", e.target.value)} placeholder="Describe the issue..." />
          </div>

          {/* Customer Reply */}
          <div className="mb-6 relative" ref={templateRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-[#48484a] uppercase tracking-wide">Customer Reply</label>
              <button onClick={() => setShowTemplates(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                style={{ background: "rgba(113,49,214,0.07)" }}>
                <FileText size={12} /> Insert Template <ChevronDown size={11} className={`transition-transform ${showTemplates ? "rotate-180" : ""}`} />
              </button>
            </div>

            {showTemplates && (
              <div className="absolute top-8 right-0 w-full sm:w-[420px] rounded-2xl overflow-hidden z-30"
                style={{ background: "var(--surface-lowest)", boxShadow: "0 16px 48px rgba(26,28,28,0.18)", border: "1px solid rgba(204,195,215,0.2)" }}>
                <div className="p-3" style={{ borderBottom: "1px solid rgba(204,195,215,0.12)" }}>
                  <input type="text" placeholder="Search templates..." value={templateSearch}
                    onChange={e => setTemplateSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: "var(--surface-low)" }} autoFocus />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {categories.length === 0 ? (
                    <p className="text-xs text-[#48484a] text-center py-6">No templates found</p>
                  ) : categories.map(cat => (
                    <div key={cat}>
                      <p className="text-label-caps text-[#48484a] px-4 pt-3 pb-1">{cat}</p>
                      {filteredCanned.filter(cr => cr.category === cat).map(cr => (
                        <button key={cr.id} onClick={() => insertTemplate(cr.id, cr.body)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-all hover:bg-[rgba(113,49,214,0.04)]">
                          <div>
                            <p className="text-sm font-medium text-[#1a1c1c]">{cr.title}</p>
                            <p className="text-xs text-[#48484a] truncate max-w-[300px]">{cr.body.slice(0, 60)}…</p>
                          </div>
                          {insertedId === cr.id
                            ? <Check size={14} className="text-emerald-500 flex-shrink-0" />
                            : <span className="text-xs text-purple-600 flex-shrink-0 ml-2">Insert</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea ref={replyRef} rows={4} value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Type a reply to the customer, or insert a template above…"
              className="w-full px-4 py-3 rounded-xl text-sm text-[#1a1c1c] outline-none resize-none transition-all focus:ring-2 focus:ring-purple-200 placeholder:text-[#48484a] leading-relaxed"
              style={{ background: "var(--surface-low)" }}
              onFocus={e => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={e => (e.target.style.background = "var(--surface-low)")} />

            {replyText.trim() && (
              <div className="flex items-center gap-2 mt-2 justify-end flex-wrap">
                <button onClick={sendReplyAsNote}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#48484a] hover:bg-[#f3f3f3] transition-colors">
                  <MessageSquare size={12} /> Log as Note
                </button>
                {form.email && (
                  <button onClick={sendReplyAsEmail} disabled={emailSending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
                      emailSent
                        ? "text-emerald-700 bg-emerald-50"
                        : "text-blue-700 hover:bg-blue-50"
                    }`}
                    style={{ background: emailSent ? undefined : "rgba(0,88,191,0.08)" }}>
                    {emailSent ? <Check size={12} /> : <Mail size={12} />}
                    {emailSending ? "Sending…" : emailSent ? "Email Sent" : "Send Email"}
                  </button>
                )}
                {form.phone && (
                  <button onClick={openWhatsApp}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                    style={{ background: "rgba(16,185,129,0.08)" }}>
                    <Smartphone size={12} /> Send via WhatsApp
                  </button>
                )}
              </div>
            )}
            {emailError && (
              <p className="text-xs text-red-500 mt-1.5 text-right">{emailError}</p>
            )}
          </div>

          {/* ── Notes / Activity tabs ── */}
          <div className="pt-5" style={{ borderTop: "1px solid rgba(204,195,215,0.15)" }}>
            {/* Tab bar */}
            <div className="flex items-center gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: "var(--surface-low)" }}>
              <button
                onClick={() => setBottomTab("notes")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bottomTab === "notes" ? "gradient-primary text-white shadow-sm" : "text-[#48484a] hover:text-[#1a1c1c]"}`}>
                <MessageSquare size={12} /> Notes
                {notes.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${bottomTab === "notes" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"}`}>
                    {notes.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setBottomTab("activity")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bottomTab === "activity" ? "gradient-primary text-white shadow-sm" : "text-[#48484a] hover:text-[#1a1c1c]"}`}>
                <Activity size={12} /> Activity
                {auditLog.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${bottomTab === "activity" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {auditLog.length}
                  </span>
                )}
              </button>
            </div>

            {/* Notes tab */}
            {bottomTab === "notes" && (
              <>
                {notes.length > 0 ? (
                  <div className="flex flex-col gap-2 mb-4">
                    {notes.map(note => (
                      <div key={note.id} className={`px-4 py-3 rounded-xl ${note.author === "System" ? "border border-dashed" : ""}`}
                        style={{ background: "var(--surface-low)", borderColor: note.author === "System" ? "rgba(245,158,11,0.3)" : undefined }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold ${note.author === "System" ? "text-amber-600" : "text-purple-600"}`}>{note.author}</span>
                          <span className="text-[10px] text-[#48484a]">{note.timestamp}</span>
                        </div>
                        <p className="text-sm text-[#1a1c1c] leading-relaxed">{note.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#48484a] mb-4">No notes yet.</p>
                )}
                <div className="flex gap-2">
                  <textarea rows={2} value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
                    placeholder="Write a note… (⌘↵ to submit)"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none resize-none transition-all focus:ring-2 focus:ring-purple-200 placeholder:text-[#48484a]"
                    style={{ background: "var(--surface-low)" }}
                    onFocus={e => (e.target.style.background = "var(--surface-lowest)")}
                    onBlur={e => (e.target.style.background = "var(--surface-low)")} />
                  <button onClick={addNote} disabled={!noteText.trim()}
                    className="px-3 rounded-xl gradient-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                    <Send size={14} />
                  </button>
                </div>
              </>
            )}

            {/* Activity log tab */}
            {bottomTab === "activity" && (
              <div className="flex flex-col">
                {auditLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-2">
                      <Activity size={16} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-[#1a1c1c] mb-0.5">No activity yet</p>
                    <p className="text-xs text-[#48484a]">Changes to status, agent and priority will appear here.</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[rgba(204,195,215,0.3)]" />
                    <div className="flex flex-col gap-0">
                      {auditLog.map((entry, i) => {
                        const { icon, color, bg } = auditIconMap[entry.action] ?? auditIconMap.created;
                        return (
                          <div key={entry.id} className={`flex items-start gap-3 py-2.5 ${i < auditLog.length - 1 ? "" : ""}`}>
                            {/* Icon dot */}
                            <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 ${bg} ${color}`}>
                              {icon}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-1">
                              <p className="text-sm text-[#1a1c1c] leading-snug">{auditLabel(entry)}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-medium text-purple-600">{entry.author}</span>
                                <span className="text-xs text-[#48484a]">· {entry.timestamp}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Created at marker */}
                      <div className="flex items-start gap-3 py-2.5">
                        <div className="relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-500">
                          <Plus size={11} />
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm text-[#1a1c1c]">Ticket created</p>
                          <span className="text-xs text-[#48484a]">{ticket.created}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#48484a] transition-colors"
              style={{ background: "var(--surface-low)" }}>Cancel</button>
            <button onClick={handleSave} disabled={!dirty}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
