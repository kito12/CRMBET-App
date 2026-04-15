"use client";

import { useState, useEffect } from "react";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/data";
import { useData } from "@/components/DataProvider";
import { StatusPill, PriorityPill } from "@/components/ui/StatusPill";
import { Search, Plus, Link2, Download, ChevronLeft, ChevronRight, CheckCircle2, LayoutList, Columns } from "lucide-react";
import CopyButton from "@/components/ui/CopyButton";
import Modal from "@/components/ui/Modal";
import { InputField, SelectField, TextareaField } from "@/components/ui/FormField";
import TicketDetailModal from "@/components/tickets/TicketDetailModal";
import KanbanBoard from "@/components/tickets/KanbanBoard";
import { SkeletonTableRow } from "@/components/ui/Skeleton";

const statusFilters = ["All", "Open", "In Progress", "Resolved", "On Hold"] as const;
const agents = ["Unassigned", "Sarah K.", "James R.", "Tom H.", "Mia S.", "Daniel P.", "Omar K.", "Yuki T."];
const CURRENT_AGENT = "Sarah K."; // would come from auth in production
const agentViews = ["All", "Mine", "Unassigned"] as const;
type AgentView = typeof agentViews[number];
const ITEMS_PER_PAGE = 10;

const emptyForm = {
  clientId: "", customer: "", email: "", phone: "",
  issue: "Withdrawal Issue", priority: "Medium" as TicketPriority,
  agent: "Unassigned", description: "",
};

// SLA dot color for open tickets
function getSLADotClass(created: string, status: TicketStatus): string {
  if (status === "Resolved" || status === "On Hold") return "bg-emerald-400";
  try {
    const m = created.match(/^(\w{3})\s+(\d+),\s+(\d{2}):(\d{2})$/);
    if (!m) return "bg-slate-300";
    const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const d = new Date(new Date().getFullYear(), months[m[1]], +m[2], +m[3], +m[4]);
    if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 10)  return "bg-emerald-400";
    if (mins < 30)  return "bg-amber-400";
    return "bg-red-400";
  } catch { return "bg-slate-300"; }
}

export default function TicketsPage() {
  const { tickets, setTickets, customers, hydrated } = useData();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Partial<typeof emptyForm>>({});
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [page, setPage]           = useState(1);
  const [agentView, setAgentView] = useState<AgentView>("All");
  const [viewMode, setViewMode]   = useState<"table" | "board">("table");

  // Handle URL params: ?open=TKT-XXXX, ?new=1, ?clientId=CLT-XXXX
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");
    const openId   = params.get("open");
    const isNew    = params.get("new");
    const status   = params.get("status");
    if (clientId) {
      const match = customers.find(c => c.clientId === clientId);
      if (match) {
        setForm(f => ({ ...f, clientId, customer: match.name, email: match.email, phone: match.phone }));
        setModalOpen(true);
      }
      history.replaceState({}, "", "/tickets");
    }
    if (openId) {
      const t = tickets.find(tk => tk.id === openId);
      if (t) setSelectedTicket(t);
      history.replaceState({}, "", "/tickets");
    }
    if (isNew) {
      setModalOpen(true);
      history.replaceState({}, "", "/tickets");
    }
    if (status && statusFilters.includes(status as typeof statusFilters[number])) {
      setActiveFilter(status);
      history.replaceState({}, "", "/tickets");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Reset page when filter/search changes
  useEffect(() => { setPage(1); }, [search, activeFilter, agentView]);

  function handleClientIdChange(val: string) {
    const match = customers.find(c => c.clientId.toLowerCase() === val.toLowerCase());
    if (match) {
      setForm(f => ({ ...f, clientId: val, customer: match.name, email: match.email, phone: match.phone }));
    } else {
      setForm(f => ({ ...f, clientId: val }));
    }
  }

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      t.customer.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.clientId.toLowerCase().includes(search.toLowerCase()) ||
      t.issue.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = activeFilter === "All" || t.status === activeFilter;
    const matchesAgent =
      agentView === "All" ? true :
      agentView === "Mine" ? t.agent === CURRENT_AGENT :
      t.agent === "Unassigned";
    return matchesSearch && matchesStatus && matchesAgent;
  });

  function quickResolve(e: React.MouseEvent, ticketId: string) {
    e.stopPropagation();
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: "Resolved" as TicketStatus } : t));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Page number buttons (show up to 5)
  function pageButtons() {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }

  function validate() {
    const e: Partial<typeof emptyForm> = {};
    if (!form.customer.trim()) e.customer = "Required";
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    return e;
  }

  function handleSaveTicket(updated: Ticket) {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const now = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const label = `${months[now.getMonth()]} ${now.getDate()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const nextNum = Math.max(...tickets.map(t => parseInt(t.id.replace("TKT-", "")))) + 1;
    setTickets(prev => [{
      id: `TKT-${nextNum}`, clientId: form.clientId || "—", customer: form.customer,
      email: form.email, phone: form.phone, issue: form.issue, priority: form.priority,
      status: "Open" as TicketStatus, agent: form.agent, created: label, description: form.description,
    }, ...prev]);
    setForm(emptyForm); setErrors({}); setModalOpen(false);
  }

  function exportCSV() {
    const headers = ["Ticket ID","Client ID","Customer","Email","Phone","Issue","Priority","Status","Agent","Created"];
    const rows = filtered.map(t => [t.id, t.clientId, t.customer, t.email, t.phone, t.issue, t.priority, t.status, t.agent, t.created]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "tickets.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-label-caps text-[#48484a] mb-1">Support</p>
          <h1 className="text-display text-[#1a1c1c]">Tickets</h1>
          <p className="text-sm text-[#48484a] mt-1">All customer support requests</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* View toggle */}
          <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--surface-low)" }}>
            <button onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all duration-150 ${viewMode === "table" ? "gradient-primary text-white" : "text-[#48484a] hover:text-[#1a1c1c]"}`}>
              <LayoutList size={14} /> Table
            </button>
            <button onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all duration-150 ${viewMode === "board" ? "gradient-primary text-white" : "text-[#48484a] hover:text-[#1a1c1c]"}`}>
              <Columns size={14} /> Board
            </button>
          </div>
          <button onClick={exportCSV}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#48484a] transition-colors hover:bg-[#f3f3f3]"
            style={{ background: "var(--surface-lowest)", border: "1px solid rgba(204,195,215,0.3)" }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setModalOpen(true)}
            className="gradient-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity shadow-ambient">
            <Plus size={15} /> New Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Row 1: search + agent view tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#48484a]" />
            <input type="text" placeholder="Search tickets, client ID..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] placeholder:text-[#48484a] outline-none focus:ring-2 focus:ring-purple-200 transition-all"
              style={{ background: "var(--surface-low)" }}
              onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={(e) => (e.target.style.background = "var(--surface-low)")} />
          </div>
          {/* Agent view tabs */}
          <div className="flex items-center rounded-xl overflow-hidden" style={{ background: "var(--surface-low)" }}>
            {agentViews.map(v => (
              <button key={v} onClick={() => setAgentView(v)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-150 ${agentView === v ? "gradient-primary text-white" : "text-[#48484a] hover:text-[#1a1c1c]"}`}>
                {v === "Mine" ? `My Tickets` : v === "Unassigned" ? "Unassigned" : "All Tickets"}
              </button>
            ))}
          </div>
        </div>
        {/* Row 2: status filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {statusFilters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${activeFilter === f ? "gradient-primary text-white shadow-float" : "text-[#48484a] hover:bg-[#f3f3f3]"}`}
              style={activeFilter !== f ? { background: "var(--surface-lowest)" } : {}}>
              {f}
            </button>
          ))}
          <span className="ml-2 text-xs text-[#48484a]">{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* ── Kanban Board ── */}
      {viewMode === "board" && (
        <KanbanBoard
          tickets={filtered}
          onUpdateStatus={(id, status) =>
            setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t))
          }
          onSelect={setSelectedTicket}
        />
      )}

      {/* Mobile card list — only shown in table mode */}
      <div className={`flex md:hidden flex-col gap-2 mb-6 ${viewMode === "board" ? "hidden" : ""}`}>
        {!hydrated ? (
          [1,2,3,4,5].map(i => <SkeletonTableRow key={i} cols={3} />)
        ) : paginated.length === 0 ? (
          <p className="text-center text-sm text-[#48484a] py-12">No tickets match your search.</p>
        ) : paginated.map(ticket => (
          <div key={ticket.id} onClick={() => setSelectedTicket(ticket)}
            className="group rounded-2xl p-4 cursor-pointer transition-all"
            style={{ background: "var(--surface-lowest)", boxShadow: "0 2px 12px 0 rgba(26,28,28,0.06)" }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-purple-600">{ticket.id}</span>
                <PriorityPill priority={ticket.priority} />
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={ticket.status} />
                {ticket.status !== "Resolved" && (
                  <button onClick={(e) => quickResolve(e, ticket.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all">
                    <CheckCircle2 size={16} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm font-medium text-[#1a1c1c] mb-0.5">{ticket.customer}</p>
            <p className="text-xs text-[#48484a] mb-2">{ticket.issue} · {ticket.phone}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#48484a]">{ticket.agent}</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${getSLADotClass(ticket.created, ticket.status)}`} />
                <span className="text-xs text-[#48484a]">{ticket.created}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table — hidden in board mode */}
      <div className={`${viewMode === "board" ? "hidden" : "hidden md:block"} rounded-2xl overflow-hidden`} style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
        <div className="grid grid-cols-[0.7fr_0.8fr_1.3fr_1.1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_36px] gap-3 px-6 py-3" style={{ background: "var(--surface-low)" }}>
          {["TICKET","CLIENT ID","CUSTOMER","PHONE","ISSUE TYPE","PRIORITY","STATUS","AGENT","CREATED",""].map(h => (
            <span key={h} className="text-label-caps text-[#48484a]">{h}</span>
          ))}
        </div>

        <div className="flex flex-col p-3 gap-1">
          {!hydrated ? (
            [1,2,3,4,5,6,7,8].map(i => <SkeletonTableRow key={i} cols={9} />)
          ) : paginated.length === 0 ? (
            <div className="py-16 text-center text-[#48484a] text-sm">No tickets match your search.</div>
          ) : paginated.map(ticket => (
            <div key={ticket.id}
              className="group grid grid-cols-[0.7fr_0.8fr_1.3fr_1.1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_36px] gap-3 items-center px-3 py-3.5 rounded-xl cursor-pointer transition-all duration-150"
              style={{ background: "transparent" }}
              onClick={() => setSelectedTicket(ticket)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-low)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-sm font-medium text-purple-600 truncate">{ticket.id}</span>
                {ticket.headOfficeUrl && <Link2 size={11} className="text-[#48484a] flex-shrink-0" />}
                <CopyButton text={ticket.id} />
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-xs font-medium text-[#0058bf] truncate">{ticket.clientId}</span>
                <CopyButton text={ticket.clientId} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-[#1a1c1c]">{ticket.customer}</p>
                  {ticket.source === "web_form" && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 uppercase tracking-wide flex-shrink-0">Web</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-[#48484a] truncate">{ticket.email || ticket.phone || "—"}</p>
                  <CopyButton text={ticket.email || ticket.phone} />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#48484a] whitespace-nowrap">{ticket.phone}</span>
                <CopyButton text={ticket.phone} />
              </div>
              <span className="text-sm text-[#48484a]">{ticket.issue}</span>
              <PriorityPill priority={ticket.priority} />
              <StatusPill status={ticket.status} />
              <span className="text-sm text-[#48484a]">{ticket.agent}</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getSLADotClass(ticket.created, ticket.status)}`} />
                <span className="text-xs text-[#48484a]">{ticket.created}</span>
              </div>
              {/* Quick resolve */}
              <div className="flex items-center justify-center">
                {ticket.status !== "Resolved" ? (
                  <button
                    onClick={(e) => quickResolve(e, ticket.id)}
                    title="Quick resolve"
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all duration-150"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                ) : (
                  <CheckCircle2 size={16} className="text-emerald-500 opacity-40" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-6 py-3"
          style={{ borderTop: "1px solid rgba(204,195,215,0.15)", background: "var(--surface-low)" }}>
          <span className="text-xs text-[#48484a]">
            Showing {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} tickets
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#48484a] transition-colors disabled:opacity-30 hover:bg-white">
              <ChevronLeft size={14} />
            </button>
            {pageButtons().map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-xs text-[#48484a]">…</span>
              ) : (
                <button key={p} onClick={() => setPage(p as number)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${page === p ? "gradient-primary text-white" : "text-[#48484a] hover:bg-white"}`}>
                  {p}
                </button>
              )
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#48484a] transition-colors disabled:opacity-30 hover:bg-white">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* New Ticket Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setErrors({}); setForm(emptyForm); }} title="New Ticket" subtitle="Create a new customer support request">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <InputField label="Client ID" placeholder="CLT-10042 (auto-fills details)" value={form.clientId}
              onChange={(e) => handleClientIdChange(e.target.value)} />
            {form.clientId && customers.find(c => c.clientId.toLowerCase() === form.clientId.toLowerCase()) && (
              <p className="text-xs text-emerald-600 mt-1">✓ Client found — details auto-filled</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <InputField label="Customer Name" placeholder="John Smith" value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })} />
              {errors.customer && <p className="text-xs text-red-500 mt-1">{errors.customer}</p>}
            </div>
            <div>
              <InputField label="Email (optional)" type="email" placeholder="john@email.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>
          <InputField label="Phone Number" type="tel" placeholder="+1 555 000 0000" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Issue Type" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })}>
              {["Withdrawal Issue","Bet Settlement","Account Access","Bonus Dispute","Live Betting"].map(o => <option key={o}>{o}</option>)}
            </SelectField>
            <SelectField label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}>
              {(["High","Medium","Low"] as TicketPriority[]).map(o => <option key={o}>{o}</option>)}
            </SelectField>
          </div>
          <SelectField label="Assign Agent" value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })}>
            {agents.map(a => <option key={a}>{a}</option>)}
          </SelectField>
          <TextareaField label="Description" placeholder="Describe the issue..." value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setModalOpen(false); setErrors({}); setForm(emptyForm); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#48484a]"
              style={{ background: "var(--surface-low)" }}>
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity">
              Create Ticket
            </button>
          </div>
        </form>
      </Modal>

      <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onSave={handleSaveTicket} />
    </div>
  );
}
