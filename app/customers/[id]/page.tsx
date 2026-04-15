"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Ticket, TicketPriority, TicketStatus, CustomerStatus, AccountType } from "@/lib/data";
import { useData } from "@/components/DataProvider";
import { StatusPill, PriorityPill } from "@/components/ui/StatusPill";
import { ArrowLeft, Mail, Phone, Globe, Calendar, Ticket as TicketIcon, AlertCircle, CheckCircle2, Plus, Edit2 } from "lucide-react";
import TicketDetailModal from "@/components/tickets/TicketDetailModal";
import Modal from "@/components/ui/Modal";
import { InputField, SelectField, TextareaField } from "@/components/ui/FormField";
import CopyButton from "@/components/ui/CopyButton";

const accountTypePill: Record<string, string> = {
  VIP:      "bg-purple-50 text-purple-700",
  Premium:  "bg-blue-50 text-blue-700",
  Standard: "bg-slate-100 text-slate-600",
};

const statusDot: Record<string, string> = {
  Active:    "bg-emerald-400",
  Suspended: "bg-red-400",
  Inactive:  "bg-slate-300",
};

export default function CustomerProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { tickets, setTickets, customers, setCustomers } = useData();
  const customer = customers.find(c => c.clientId === id);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [customerStatus, setCustomerStatus] = useState<CustomerStatus>(customer?.status ?? "Active");
  const [statusToast, setStatusToast] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    issue: "Withdrawal Issue", priority: "Medium" as TicketPriority,
    agent: "Unassigned", description: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    country: customer?.country ?? "",
    accountType: customer?.accountType ?? "Standard" as AccountType,
  });

  if (!customer) return null;

  const agents = ["Unassigned", "Sarah K.", "James R.", "Tom H.", "Mia S.", "Daniel P.", "Omar K.", "Yuki T."];

  function changeStatus(s: CustomerStatus) {
    setCustomerStatus(s);
    setCustomers(prev => prev.map(c => c.clientId === id ? { ...c, status: s } : c));
    setStatusToast(true);
    setTimeout(() => setStatusToast(false), 2000);
  }

  function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    setCustomers(prev => prev.map(c => c.clientId === id ? { ...c, ...editForm } : c));
    setEditOpen(false);
  }

  function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    const now = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const label = `${months[now.getMonth()]} ${now.getDate()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const nextNum = Math.max(...tickets.map(t => parseInt(t.id.replace("TKT-","")))) + 1;
    setTickets(prev => [{
      id: `TKT-${nextNum}`, clientId: customer.clientId, customer: customer.name,
      email: customer.email, phone: customer.phone, issue: ticketForm.issue,
      priority: ticketForm.priority, status: "Open" as TicketStatus,
      agent: ticketForm.agent, created: label, description: ticketForm.description,
    }, ...prev]);
    setNewTicketOpen(false);
    setTicketForm({ issue: "Withdrawal Issue", priority: "Medium", agent: "Unassigned", description: "" });
  }

  const clientTickets = tickets
    .filter(t => t.clientId === customer.clientId)
    .sort((a, b) => b.id.localeCompare(a.id));

  const openCount     = clientTickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
  const resolvedCount = clientTickets.filter(t => t.status === "Resolved").length;

  const initials = customer.name.split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Back */}
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-[#48484a] hover:text-[#1a1c1c] transition-colors mb-6">
        <ArrowLeft size={14} /> Back to Customers
      </Link>

      {/* 60/40 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* LEFT — profile + tickets */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Profile card */}
          <div className="rounded-2xl p-7" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h1 className="text-headline text-[#1a1c1c]">{customer.name}</h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${accountTypePill[customer.accountType]}`}>
                    {customer.accountType}
                  </span>
                  <div className="flex items-center gap-1.5 relative">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[customerStatus]}`} />
                    <select
                      value={customerStatus}
                      onChange={(e) => changeStatus(e.target.value as CustomerStatus)}
                      className="text-xs text-[#48484a] bg-transparent outline-none cursor-pointer pr-1 appearance-none"
                    >
                      {(["Active","Suspended","Inactive"] as CustomerStatus[]).map(s => <option key={s}>{s}</option>)}
                    </select>
                    {statusToast && (
                      <span className="absolute -top-7 left-0 px-2 py-1 rounded-lg text-xs font-medium text-white whitespace-nowrap"
                        style={{ background: "#1a1c1c" }}>Status updated</span>
                    )}
                  </div>
                  <button onClick={() => setEditOpen(true)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#48484a] hover:bg-[#f3f3f3] transition-colors flex-shrink-0"
                    style={{ background: "var(--surface-low)" }}>
                    <Edit2 size={12} /> Edit
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mb-4 group/id">
                  <p className="text-label-caps text-purple-600">{customer.clientId}</p>
                  <CopyButton text={customer.clientId} size={11} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: Mail,     value: customer.email,                      copyable: true  },
                    { icon: Phone,    value: customer.phone,                      copyable: true  },
                    { icon: Globe,    value: customer.country,                    copyable: false },
                    { icon: Calendar, value: `Member since ${customer.createdAt}`, copyable: false },
                  ].map(({ icon: Icon, value, copyable }) => (
                    <div key={value} className="group flex items-center gap-2">
                      <Icon size={13} className="text-[#48484a] flex-shrink-0" />
                      <span className="text-sm text-[#48484a]">{value}</span>
                      {copyable && <CopyButton text={value} size={11} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ticket history */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <div className="mb-5">
              <p className="text-label-caps text-[#48484a] mb-1">History</p>
              <h2 className="text-xl font-semibold text-[#1a1c1c] tracking-tight">Ticket Timeline</h2>
            </div>

            {clientTickets.length === 0 ? (
              <p className="text-sm text-[#48484a] py-8 text-center">No tickets yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Column headers */}
                <div className="grid grid-cols-[0.9fr_1.2fr_0.9fr_0.8fr_1fr] gap-3 px-3 mb-1">
                  {["TICKET", "ISSUE", "PRIORITY", "STATUS", "AGENT"].map(h => (
                    <span key={h} className="text-label-caps text-[#48484a]">{h}</span>
                  ))}
                </div>
                {clientTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="grid grid-cols-[0.9fr_1.2fr_0.9fr_0.8fr_1fr] gap-3 items-center px-3 py-3 rounded-xl transition-all duration-150 cursor-pointer"
                    style={{ background: "var(--surface-low)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-lowest)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-low)")}
                  >
                    <div>
                      <p className="text-sm font-medium text-purple-600">{ticket.id}</p>
                      <p className="text-xs text-[#48484a]">{ticket.created}</p>
                    </div>
                    <span className="text-sm text-[#48484a]">{ticket.issue}</span>
                    <PriorityPill priority={ticket.priority} />
                    <StatusPill status={ticket.status} />
                    <span className="text-sm text-[#48484a]">{ticket.agent}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — stats */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Ticket stats */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <p className="text-label-caps text-[#48484a] mb-1">Summary</p>
            <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-5">Support Stats</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: TicketIcon,   label: "TOTAL",    value: clientTickets.length, color: "text-purple-600", bg: "bg-purple-50" },
                { icon: AlertCircle,  label: "OPEN",     value: openCount,            color: "text-amber-600",  bg: "bg-amber-50" },
                { icon: CheckCircle2, label: "RESOLVED", value: resolvedCount,        color: "text-emerald-600",bg: "bg-emerald-50" },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--surface-low)" }}>
                  <div className={`inline-flex p-1.5 rounded-lg ${bg} mb-2`}>
                    <Icon size={14} className={color} />
                  </div>
                  <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
                  <p className="text-xl font-bold text-[#1a1c1c]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Issue breakdown */}
          {clientTickets.length > 0 && (
            <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
              <p className="text-label-caps text-[#48484a] mb-1">Patterns</p>
              <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-4">Issue Types</h3>
              {Array.from(new Set(clientTickets.map(t => t.issue))).map(issue => {
                const count = clientTickets.filter(t => t.issue === issue).length;
                const pct = Math.round((count / clientTickets.length) * 100);
                return (
                  <div key={issue} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-[#1a1c1c]">{issue}</span>
                      <span className="text-xs text-[#48484a]">{count}x</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: "var(--surface-low)" }}>
                      <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Activity timeline */}
          {(() => {
            function parseTs(ts: string): number {
              try {
                const m = ts.match(/^(\w{3})\s+(\d+),\s+(\d{2}):(\d{2})$/);
                if (!m) return 0;
                const months: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
                const d = new Date(new Date().getFullYear(), months[m[1]], +m[2], +m[3], +m[4]);
                if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
                return d.getTime();
              } catch { return 0; }
            }

            const events = clientTickets
              .flatMap(t => (t.auditLog ?? []).map(e => ({ ...e, ticketId: t.id })))
              .sort((a, b) => parseTs(b.timestamp) - parseTs(a.timestamp))
              .slice(0, 8);

            if (events.length === 0) return null;

            const dotColor: Record<string, string> = {
              created: "bg-purple-400",
              status_changed: "bg-blue-400",
              agent_changed: "bg-indigo-400",
              escalated: "bg-amber-400",
              priority_changed: "bg-orange-400",
              note_added: "bg-slate-400",
            };

            function label(e: typeof events[0]): string {
              switch (e.action) {
                case "created":         return `${e.ticketId} opened`;
                case "status_changed":  return `${e.ticketId} → ${e.to}`;
                case "agent_changed":   return `${e.ticketId} assigned to ${e.to}`;
                case "escalated":       return `${e.ticketId} escalated to ${e.to}`;
                case "priority_changed":return `${e.ticketId} priority → ${e.to}`;
                case "note_added":      return `Note added to ${e.ticketId}`;
                default:                return e.ticketId;
              }
            }

            return (
              <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
                <p className="text-label-caps text-[#48484a] mb-1">History</p>
                <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-4">Activity</h3>
                <div className="flex flex-col gap-0">
                  {events.map((e, i) => (
                    <div key={e.id} className="flex items-start gap-3 relative">
                      {/* Vertical line */}
                      {i < events.length - 1 && (
                        <div className="absolute left-[5px] top-4 bottom-0 w-px" style={{ background: "var(--surface-low)" }} />
                      )}
                      <span className={`mt-1 flex-shrink-0 w-3 h-3 rounded-full border-2 border-white ${dotColor[e.action] ?? "bg-slate-400"}`}
                        style={{ borderColor: "var(--surface-lowest)" }} />
                      <div className="pb-4 min-w-0">
                        <p className="text-sm text-[#1a1c1c] leading-snug">{label(e)}</p>
                        <p className="text-xs text-[#48484a]">{e.author} · {e.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Quick actions */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <p className="text-label-caps text-[#48484a] mb-4">Actions</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => setNewTicketOpen(true)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white gradient-primary text-center hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                <Plus size={13} /> New Ticket for this Client
              </button>
              <button className="w-full py-2.5 rounded-xl text-sm font-medium text-[#48484a] transition-colors hover:bg-[#f3f3f3]"
                style={{ background: "var(--surface-low)" }}>
                Send Email
              </button>
              <button className="w-full py-2.5 rounded-xl text-sm font-medium text-emerald-700 transition-colors"
                style={{ background: "#f0fdf4" }}>
                WhatsApp (coming soon)
              </button>
            </div>
          </div>
        </div>
      </div>

      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onSave={(updated) => {
          setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
          setSelectedTicket(null);
        }}
      />

      {/* New Ticket Modal — pre-filled with customer */}
      <Modal open={newTicketOpen} onClose={() => setNewTicketOpen(false)}
        title="New Ticket" subtitle={`For ${customer.name} · ${customer.clientId}`}>
        <form onSubmit={handleCreateTicket} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-[#1a1c1c]">{customer.name}</p>
              <p className="text-xs text-[#48484a]">{customer.email} · {customer.phone}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Issue Type" value={ticketForm.issue} onChange={(e) => setTicketForm({ ...ticketForm, issue: e.target.value })}>
              {["Withdrawal Issue","Restricted Withdrawals","Deposits","Blocked Accounts","Bet Settlement","Account Access","Bonus Dispute","Live Betting","Other"].map(o => <option key={o}>{o}</option>)}
            </SelectField>
            <SelectField label="Priority" value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as TicketPriority })}>
              {(["High","Medium","Low"] as TicketPriority[]).map(o => <option key={o}>{o}</option>)}
            </SelectField>
          </div>
          <SelectField label="Assign Agent" value={ticketForm.agent} onChange={(e) => setTicketForm({ ...ticketForm, agent: e.target.value })}>
            {agents.map(a => <option key={a}>{a}</option>)}
          </SelectField>
          <TextareaField label="Description" placeholder="Describe the issue..." value={ticketForm.description}
            onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setNewTicketOpen(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#48484a]"
              style={{ background: "var(--surface-low)" }}>Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity">
              Create Ticket
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile" subtitle={`${customer.clientId} · ${customer.accountType}`}>
        <form onSubmit={handleEditSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Full Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            <InputField label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Phone Number" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required />
            <InputField label="Country" value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} required />
          </div>
          <SelectField label="Account Type" value={editForm.accountType} onChange={(e) => setEditForm({ ...editForm, accountType: e.target.value as AccountType })}>
            {(["Standard", "Premium", "VIP"] as AccountType[]).map(t => <option key={t}>{t}</option>)}
          </SelectField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditOpen(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#48484a]"
              style={{ background: "var(--surface-low)" }}>Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
