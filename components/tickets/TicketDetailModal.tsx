"use client";

import { useState, useEffect } from "react";
import { X, Hash, ExternalLink, Clock, MessageSquare, Send } from "lucide-react";
import type { Ticket, TicketStatus, TicketPriority, Note } from "@/lib/data";
import { StatusPill, PriorityPill } from "@/components/ui/StatusPill";
import { InputField, SelectField, TextareaField } from "@/components/ui/FormField";

interface Props {
  ticket: Ticket | null;
  onClose: () => void;
  onSave: (updated: Ticket) => void;
}

const agents = ["Unassigned", "Sarah K.", "James R.", "Tom H.", "Mia S.", "Daniel P.", "Omar K.", "Yuki T."];

// Parse "Apr 14, 09:12" → Date
function parseCreated(created: string): Date | null {
  try {
    const m = created.match(/^(\w{3})\s+(\d+),\s+(\d{2}):(\d{2})$/);
    if (!m) return null;
    const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
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

function getSLABadge(created: string, status: TicketStatus): { label: string; cls: string } {
  if (status === "Resolved") return { label: "Resolved", cls: "bg-emerald-50 text-emerald-700" };
  if (status === "On Hold")  return { label: "On Hold",  cls: "bg-amber-50 text-amber-700" };
  const d = parseCreated(created);
  if (!d) return { label: "—", cls: "bg-slate-100 text-slate-500" };
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 10)  return { label: "Within SLA", cls: "bg-emerald-50 text-emerald-700" };
  if (mins < 30)  return { label: "SLA Warning", cls: "bg-amber-50 text-amber-700" };
  return { label: "SLA Breached", cls: "bg-red-50 text-red-600" };
}

function nowLabel(): string {
  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[now.getMonth()]} ${now.getDate()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
}

export default function TicketDetailModal({ ticket, onClose, onSave }: Props) {
  const [form, setForm] = useState<Ticket | null>(null);
  const [dirty, setDirty] = useState(false);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (ticket) { setForm({ ...ticket }); setDirty(false); setNoteText(""); }
  }, [ticket]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!ticket || !form) return null;

  function update<K extends keyof Ticket>(key: K, value: Ticket[K]) {
    setForm(f => f ? { ...f, [key]: value } : f);
    setDirty(true);
  }

  function handleSave() {
    if (form) { onSave(form); onClose(); }
  }

  function addNote() {
    if (!noteText.trim() || !form) return;
    const note: Note = {
      id: Date.now().toString(),
      author: "You",
      text: noteText.trim(),
      timestamp: nowLabel(),
    };
    const updated: Ticket = { ...form, notes: [...(form.notes ?? []), note] };
    setForm(updated);
    onSave(updated);
    setNoteText("");
  }

  const sla = getSLABadge(ticket.created, form.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(26,28,28,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-2xl z-10 overflow-hidden flex flex-col"
        style={{ background: "var(--surface-lowest)", boxShadow: "0 24px 80px 0 rgba(26,28,28,0.14)", maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 flex-shrink-0" style={{ background: "var(--surface-low)" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl gradient-primary">
              <Hash size={14} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-[#1a1c1c] tracking-tight">{ticket.id}</h2>
                <span className="text-xs font-medium text-[#0058bf]">{ticket.clientId}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sla.cls}`}>
                  <Clock size={10} /> {sla.label}
                </span>
              </div>
              <p className="text-xs text-[#48484a]">Created {ticket.created} · {getElapsed(ticket.created)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#48484a] hover:bg-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-7">
          {/* Status + Priority + Agent */}
          <div className="flex items-center gap-3 mb-6 p-4 rounded-xl" style={{ background: "var(--surface-low)" }}>
            <div className="flex-1">
              <p className="text-label-caps text-[#48484a] mb-2">STATUS</p>
              <div className="relative">
                <select value={form.status} onChange={(e) => update("status", e.target.value as TicketStatus)}
                  className="w-full pl-3 pr-8 py-2 rounded-xl text-sm font-medium outline-none appearance-none cursor-pointer transition-all focus:ring-2 focus:ring-purple-200"
                  style={{ background: "var(--surface-lowest)" }}>
                  {(["Open", "In Progress", "On Hold", "Resolved"] as TicketStatus[]).map(s => <option key={s}>{s}</option>)}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <StatusPill status={form.status} />
                </span>
              </div>
            </div>
            <div className="w-px h-10 bg-[rgba(204,195,215,0.2)]" />
            <div className="flex-1">
              <p className="text-label-caps text-[#48484a] mb-2">PRIORITY</p>
              <div className="relative">
                <select value={form.priority} onChange={(e) => update("priority", e.target.value as TicketPriority)}
                  className="w-full pl-3 pr-8 py-2 rounded-xl text-sm font-medium outline-none appearance-none cursor-pointer transition-all focus:ring-2 focus:ring-purple-200"
                  style={{ background: "var(--surface-lowest)" }}>
                  {(["High", "Medium", "Low"] as TicketPriority[]).map(p => <option key={p}>{p}</option>)}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <PriorityPill priority={form.priority} />
                </span>
              </div>
            </div>
            <div className="w-px h-10 bg-[rgba(204,195,215,0.2)]" />
            <div className="flex-1">
              <SelectField label="Agent" value={form.agent} onChange={(e) => update("agent", e.target.value)}>
                {agents.map(a => <option key={a}>{a}</option>)}
              </SelectField>
            </div>
          </div>

          {/* Customer details */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <InputField label="Customer Name" value={form.customer} onChange={(e) => update("customer", e.target.value)} />
            <InputField label="Client ID" value={form.clientId} onChange={(e) => update("clientId", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <InputField label="Email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            <InputField label="Phone Number" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <SelectField label="Issue Type" value={form.issue} onChange={(e) => update("issue", e.target.value)}>
              {["Withdrawal Issue", "Bet Settlement", "Account Access", "Bonus Dispute", "Live Betting"].map(o => <option key={o}>{o}</option>)}
            </SelectField>
            <div />
          </div>

          {/* Head Office Link */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#48484a] mb-1.5 uppercase tracking-wide">Head Office Ticket Link</label>
            <div className="flex gap-2 items-center">
              <input type="url" placeholder="https://headoffice.crm/tickets/..."
                value={form.headOfficeUrl ?? ""}
                onChange={(e) => update("headOfficeUrl", e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none transition-all focus:ring-2 focus:ring-purple-200 placeholder:text-[#48484a]"
                style={{ background: "var(--surface-low)" }}
                onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
                onBlur={(e) => (e.target.style.background = "var(--surface-low)")} />
              {form.headOfficeUrl && (
                <a href={form.headOfficeUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity whitespace-nowrap">
                  <ExternalLink size={13} /> Open
                </a>
              )}
            </div>
          </div>

          <TextareaField label="Description / Notes" value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} placeholder="Add notes about this ticket..." />

          {/* Internal Notes */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(204,195,215,0.15)" }}>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={14} className="text-[#48484a]" />
              <p className="text-sm font-semibold text-[#1a1c1c]">Internal Notes</p>
              {(form.notes ?? []).length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold gradient-primary text-white">
                  {(form.notes ?? []).length}
                </span>
              )}
            </div>

            {/* Existing notes */}
            {(form.notes ?? []).length > 0 ? (
              <div className="flex flex-col gap-2 mb-4">
                {(form.notes ?? []).map(note => (
                  <div key={note.id} className="px-4 py-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-purple-600">{note.author}</span>
                      <span className="text-[10px] text-[#48484a]">{note.timestamp}</span>
                    </div>
                    <p className="text-sm text-[#1a1c1c] leading-relaxed">{note.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#48484a] mb-4">No notes yet. Add the first one below.</p>
            )}

            {/* Add note */}
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
                placeholder="Write a note... (⌘↵ to submit)"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none resize-none transition-all focus:ring-2 focus:ring-purple-200 placeholder:text-[#48484a]"
                style={{ background: "var(--surface-low)" }}
                onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
                onBlur={(e) => (e.target.style.background = "var(--surface-low)")}
              />
              <button onClick={addNote} disabled={!noteText.trim()}
                className="px-3 rounded-xl gradient-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#48484a] transition-colors"
              style={{ background: "var(--surface-low)" }}>
              Cancel
            </button>
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
