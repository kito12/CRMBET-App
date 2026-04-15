"use client";

import { useState, useEffect, useDeferredValue, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Ticket, TicketPriority, TicketStatus, AuditEntry } from "@/lib/data";
import { useData } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import { StatusPill, PriorityPill } from "@/components/ui/StatusPill";
import { Search, Plus, Link2, Download, ChevronLeft, ChevronRight, CheckCircle2, LayoutList, Columns, SlidersHorizontal, X, Bookmark, Trash2, UserCheck2, RefreshCw } from "lucide-react";
import CopyButton from "@/components/ui/CopyButton";
import Modal from "@/components/ui/Modal";
import { InputField, SelectField, TextareaField } from "@/components/ui/FormField";
import TicketDetailModal from "@/components/tickets/TicketDetailModal";
import KanbanBoard from "@/components/tickets/KanbanBoard";
import { SkeletonTableRow } from "@/components/ui/Skeleton";

const statusFilters = ["All", "Open", "In Progress", "Resolved", "On Hold"] as const;
const agentViews = ["All", "Mine", "Unassigned"] as const;
type AgentView = typeof agentViews[number];
type DateRange = "all" | "today" | "yesterday" | "7d" | "30d";
const ITEMS_PER_PAGE = 10;

interface FilterPreset {
  id: string;
  name: string;
  status: string;
  agentView: AgentView;
  dateRange: DateRange;
  agentFilter: string;
}

function parseTicketDate(ticket: Ticket): Date | null {
  try {
    // Prefer ISO timestamp (accurate, timezone-aware)
    if (ticket.createdAt) {
      const d = new Date(ticket.createdAt);
      return isNaN(d.getTime()) ? null : d;
    }
    // Fall back to parsing the display label
    const m = ticket.created.match(/^(\w{3})\s+(\d+),\s+(\d{2}):(\d{2})$/);
    if (!m) return null;
    const months: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const d = new Date(new Date().getFullYear(), months[m[1]], +m[2], +m[3], +m[4]);
    if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
    return d;
  } catch { return null; }
}

// Format a ticket's timestamp in the viewer's local timezone
function formatCreated(ticket: Ticket): string {
  if (ticket.createdAt) {
    const d = new Date(ticket.createdAt);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  return ticket.created;
}

function getDateBounds(range: DateRange): { from: Date; to: Date } | null {
  if (range === "all") return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "today")     return { from: startOfToday, to: now };
  if (range === "yesterday") return { from: new Date(startOfToday.getTime() - 86400000), to: startOfToday };
  if (range === "7d")        return { from: new Date(now.getTime() - 7 * 86400000), to: now };
  if (range === "30d")       return { from: new Date(now.getTime() - 30 * 86400000), to: now };
  return null;
}

const emptyForm = {
  clientId: "", customer: "", email: "", phone: "",
  issue: "Withdrawal Issue", priority: "Medium" as TicketPriority,
  agent: "Unassigned", description: "",
};

// SLA dot color — respects per-priority policy
function getSLADotClass(ticket: Ticket, policy: { firstReplyMinutes: number; resolutionMinutes: number }): string {
  if (ticket.status === "Resolved") return "bg-emerald-400";
  if (ticket.status === "On Hold")  return "bg-amber-400";
  const d = parseTicketDate(ticket);
  if (!d) return "bg-slate-300";
  const elapsedMs  = Date.now() - d.getTime();
  const targetMs   = (ticket.status === "Open" ? policy.firstReplyMinutes : policy.resolutionMinutes) * 60_000;
  const pctUsed    = elapsedMs / targetMs;
  if (pctUsed < 0.75) return "bg-emerald-400";
  if (pctUsed < 1)    return "bg-amber-400";
  return "bg-red-400";
}

export default function TicketsPage() {
  const { tickets, setTickets, customers, hydrated, slaPolicy } = useData();
  const { user: currentUser } = useAuth();
  const [agentList, setAgentList] = useState<string[]>(["Unassigned"]);

  // Live agents from Firestore
  useEffect(() => {
    return onSnapshot(collection(db, "users"), snap => {
      const names = snap.docs.map(d => d.data().name as string).filter(Boolean).sort();
      setAgentList(["Unassigned", ...names]);
    });
  }, []);

  const [searchInput, setSearchInput] = useState("");
  const search = useDeferredValue(searchInput);
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Partial<typeof emptyForm>>({});
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [page, setPage]           = useState(1);
  const [agentView, setAgentView] = useState<AgentView>("All");
  const [viewMode, setViewMode]   = useState<"table" | "board">("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateRange, setDateRange]     = useState<DateRange>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  // Saved filter presets
  const [presets, setPresets]           = useState<FilterPreset[]>([]);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName]     = useState("");

  // Bulk selection
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus]     = useState<string>("");
  const [bulkAgent, setBulkAgent]       = useState<string>("");

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
  useEffect(() => { setPage(1); }, [searchInput, activeFilter, agentView, dateRange, agentFilter]);

  function handleClientIdChange(val: string) {
    const match = customers.find(c => c.clientId.toLowerCase() === val.toLowerCase());
    if (match) {
      setForm(f => ({ ...f, clientId: val, customer: match.name, email: match.email, phone: match.phone }));
    } else {
      setForm(f => ({ ...f, clientId: val }));
    }
  }

  const dateBounds = useMemo(() => getDateBounds(dateRange), [dateRange]);
  const filtered = useMemo(() => tickets.filter((t) => {
    const matchesSearch =
      t.customer.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.clientId.toLowerCase().includes(search.toLowerCase()) ||
      t.issue.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = activeFilter === "All" || t.status === activeFilter;
    const matchesAgentView =
      agentView === "All" ? true :
      agentView === "Mine" ? t.agent === currentUser?.name :
      t.agent === "Unassigned";
    const matchesAgentFilter = agentFilter === "all" || t.agent === agentFilter;
    const matchesDate = (() => {
      if (!dateBounds) return true;
      const d = parseTicketDate(t);
      if (!d) return true;
      return d >= dateBounds.from && d <= dateBounds.to;
    })();
    return matchesSearch && matchesStatus && matchesAgentView && matchesAgentFilter && matchesDate;
  }), [tickets, search, activeFilter, agentView, agentFilter, dateBounds, currentUser?.name]);

  const extraFilterCount = (dateRange !== "all" ? 1 : 0) + (agentFilter !== "all" ? 1 : 0);
  function clearExtraFilters() { setDateRange("all"); setAgentFilter("all"); }

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ticketPresets");
      if (stored) setPresets(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  function savePreset() {
    if (!presetName.trim()) return;
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      status: activeFilter,
      agentView,
      dateRange,
      agentFilter,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    try { localStorage.setItem("ticketPresets", JSON.stringify(updated)); } catch { /* ignore */ }
    setPresetName("");
    setSavePresetOpen(false);
  }

  function applyPreset(p: FilterPreset) {
    setActiveFilter(p.status);
    setAgentView(p.agentView);
    setDateRange(p.dateRange);
    setAgentFilter(p.agentFilter);
    setPage(1);
  }

  function deletePreset(id: string) {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    try { localStorage.setItem("ticketPresets", JSON.stringify(updated)); } catch { /* ignore */ }
  }

  // Bulk selection helpers
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === paginated.length && paginated.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map(t => t.id)));
    }
  }

  function applyBulkStatus() {
    if (!bulkStatus) return;
    setTickets(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status: bulkStatus as TicketStatus } : t));
    setSelectedIds(new Set());
    setBulkStatus("");
  }

  function applyBulkAgent() {
    if (!bulkAgent) return;
    setTickets(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, agent: bulkAgent } : t));
    setSelectedIds(new Set());
    setBulkAgent("");
  }

  function quickResolve(e: React.MouseEvent, ticketId: string) {
    e.stopPropagation();
    setTickets(prev => prev.map(t =>
      t.id === ticketId && t.status !== "Resolved"
        ? { ...t, status: "Resolved" as TicketStatus, resolvedAt: new Date().toISOString() }
        : t
    ));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filtered, page]
  );

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
    const newId = `TKT-${Date.now()}`;
    const authorName = currentUser?.name ?? "Agent";
    const createdEntry: AuditEntry = { id: `a-create-${Date.now()}`, action: "created", author: authorName, timestamp: label };
    setTickets(prev => [{
      id: newId, clientId: form.clientId || "—", customer: form.customer,
      email: form.email, phone: form.phone, issue: form.issue, priority: form.priority,
      status: "Open" as TicketStatus, agent: form.agent,
      created: label, createdAt: now.toISOString(),
      description: form.description, source: "agent",
      auditLog: [createdEntry],
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
            <input type="text" placeholder="Search tickets, client ID..." value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
        {/* Row 2: status filters + Filters button */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {statusFilters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${activeFilter === f ? "gradient-primary text-white shadow-float" : "text-[#48484a] hover:bg-[#f3f3f3]"}`}
              style={activeFilter !== f ? { background: "var(--surface-lowest)" } : {}}>
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-[#48484a] whitespace-nowrap">{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</span>
            <button onClick={() => setFiltersOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${filtersOpen || extraFilterCount > 0 ? "gradient-primary text-white" : "text-[#48484a] hover:bg-[#f3f3f3]"}`}
              style={!filtersOpen && extraFilterCount === 0 ? { background: "var(--surface-lowest)" } : {}}>
              <SlidersHorizontal size={13} />
              Filters
              {extraFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white/25 text-white text-[9px] font-bold flex items-center justify-center">{extraFilterCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Row 3: collapsible extra filters */}
        {filtersOpen && (
          <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl" style={{ background: "var(--surface-low)" }}>
            {/* Date range */}
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-xs font-semibold text-[#48484a] uppercase tracking-wide">Date Range</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { value: "all",       label: "All time" },
                  { value: "today",     label: "Today" },
                  { value: "yesterday", label: "Yesterday" },
                  { value: "7d",        label: "Last 7 days" },
                  { value: "30d",       label: "Last 30 days" },
                ] as { value: DateRange; label: string }[]).map(opt => (
                  <button key={opt.value} onClick={() => setDateRange(opt.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${dateRange === opt.value ? "gradient-primary text-white" : "text-[#48484a] hover:bg-white"}`}
                    style={dateRange !== opt.value ? { background: "var(--surface-lowest)" } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-10 hidden sm:block bg-[rgba(204,195,215,0.3)]" />

            {/* Agent filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#48484a] uppercase tracking-wide">Agent</span>
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                style={{ background: "var(--surface-lowest)" }}>
                <option value="all">All Agents</option>
                {agentList.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Clear */}
            {extraFilterCount > 0 && (
              <button onClick={clearExtraFilters}
                className="flex items-center gap-1 text-xs text-[#48484a] hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
                <X size={11} /> Clear filters
              </button>
            )}

            {/* Save preset */}
            <button onClick={() => setSavePresetOpen(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#48484a] hover:bg-purple-50 hover:text-purple-600 transition-colors ml-auto"
              style={{ background: "var(--surface-lowest)" }}>
              <Bookmark size={11} /> Save preset
            </button>
          </div>
          {savePresetOpen && (
            <div className="flex items-center gap-2 px-1">
              <input
                autoFocus
                type="text"
                placeholder="Preset name…"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") savePreset(); if (e.key === "Escape") setSavePresetOpen(false); }}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                style={{ background: "var(--surface-low)" }}
              />
              <button onClick={savePreset}
                className="px-3 py-1.5 rounded-lg text-xs font-medium gradient-primary text-white">
                Save
              </button>
              <button onClick={() => setSavePresetOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#48484a] hover:bg-red-50 hover:text-red-500 transition-colors"
                style={{ background: "var(--surface-low)" }}>
                <X size={11} />
              </button>
            </div>
          )}
          </>
        )}

        {/* Preset chips */}
        {presets.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[#48484a] uppercase tracking-wide flex-shrink-0">Presets:</span>
            {presets.map(p => (
              <div key={p.id} className="flex items-center gap-1 rounded-full overflow-hidden" style={{ background: "var(--surface-low)" }}>
                <button onClick={() => applyPreset(p)}
                  className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs font-medium text-[#1a1c1c] hover:text-purple-600 transition-colors">
                  <Bookmark size={10} className="text-purple-500" /> {p.name}
                </button>
                <button onClick={() => deletePreset(p.id)}
                  className="pr-2 py-1 text-[#48484a] hover:text-red-500 transition-colors">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
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
                <span className={`w-1.5 h-1.5 rounded-full ${getSLADotClass(ticket, slaPolicy[ticket.priority])}`} />
                <span className="text-xs text-[#48484a]">{formatCreated(ticket)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table — hidden in board mode */}
      <div className={`${viewMode === "board" ? "hidden" : "hidden md:block"} rounded-2xl overflow-hidden`} style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
        <div className="grid grid-cols-[28px_0.7fr_0.8fr_1.3fr_1.1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_36px] gap-3 px-6 py-3" style={{ background: "var(--surface-low)" }}>
          <div className="flex items-center justify-center">
            <input type="checkbox"
              checked={paginated.length > 0 && paginated.every(t => selectedIds.has(t.id))}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded accent-purple-600 cursor-pointer" />
          </div>
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
              className="group grid grid-cols-[28px_0.7fr_0.8fr_1.3fr_1.1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_36px] gap-3 items-center px-3 py-3.5 rounded-xl cursor-pointer transition-all duration-150"
              style={{ background: selectedIds.has(ticket.id) ? "rgba(113,49,214,0.06)" : "transparent" }}
              onClick={() => setSelectedTicket(ticket)}
              onMouseEnter={(e) => { if (!selectedIds.has(ticket.id)) e.currentTarget.style.background = "var(--surface-low)"; }}
              onMouseLeave={(e) => { if (!selectedIds.has(ticket.id)) e.currentTarget.style.background = "transparent"; }}
            >
              <div className="flex items-center justify-center" onClick={e => { e.stopPropagation(); toggleSelect(ticket.id); }}>
                <input type="checkbox" checked={selectedIds.has(ticket.id)} onChange={() => toggleSelect(ticket.id)}
                  className="w-3.5 h-3.5 rounded accent-purple-600 cursor-pointer" />
              </div>
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
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getSLADotClass(ticket, slaPolicy[ticket.priority])}`} />
                <span className="text-xs text-[#48484a]">{formatCreated(ticket)}</span>
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

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
          style={{ background: "var(--on-surface)", color: "var(--surface-lowest)", minWidth: "320px" }}>
          <span className="text-sm font-semibold flex-shrink-0">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-white/20 flex-shrink-0" />
          {/* Bulk status */}
          <div className="flex items-center gap-1.5 flex-1">
            <RefreshCw size={13} className="flex-shrink-0 opacity-60" />
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
              className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-xs font-medium outline-none cursor-pointer border border-white/20 focus:border-white/40"
              style={{ color: "var(--surface-lowest)" }}>
              <option value="">Set status…</option>
              {(["Open","In Progress","On Hold","Resolved"] as TicketStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={applyBulkStatus} disabled={!bulkStatus}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Apply
            </button>
          </div>
          <div className="w-px h-5 bg-white/20 flex-shrink-0" />
          {/* Bulk reassign */}
          <div className="flex items-center gap-1.5 flex-1">
            <UserCheck2 size={13} className="flex-shrink-0 opacity-60" />
            <select value={bulkAgent} onChange={e => setBulkAgent(e.target.value)}
              className="flex-1 bg-white/10 rounded-lg px-2 py-1 text-xs font-medium outline-none cursor-pointer border border-white/20 focus:border-white/40"
              style={{ color: "var(--surface-lowest)" }}>
              <option value="">Reassign…</option>
              {agentList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={applyBulkAgent} disabled={!bulkAgent}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Apply
            </button>
          </div>
          <div className="w-px h-5 bg-white/20 flex-shrink-0" />
          <button onClick={() => setSelectedIds(new Set())}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 transition-colors flex-shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

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
              {["Withdrawal Issue","Restricted Withdrawals","Deposits","Blocked Accounts","Bet Settlement","Account Access","Bonus Dispute","Live Betting","Other"].map(o => <option key={o}>{o}</option>)}
            </SelectField>
            <SelectField label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}>
              {(["High","Medium","Low"] as TicketPriority[]).map(o => <option key={o}>{o}</option>)}
            </SelectField>
          </div>
          <SelectField label="Assign Agent" value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })}>
            {agentList.map(a => <option key={a}>{a}</option>)}
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
