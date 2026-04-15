"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, X, ArrowRight, Ticket as TicketIcon, UserCircle,
  LayoutDashboard, Users, Settings, MessageSquare, BarChart2, Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useData } from "./DataProvider";
import { StatusPill, PriorityPill } from "./ui/StatusPill";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PAGE_SHORTCUTS = [
  { label: "Dashboard",     href: "/",           icon: LayoutDashboard, hint: "Overview & stats" },
  { label: "Tickets",       href: "/tickets",    icon: TicketIcon,       hint: "Support queue" },
  { label: "Customers",     href: "/customers",  icon: UserCircle,       hint: "Client accounts" },
  { label: "Analytics",     href: "/analytics",  icon: BarChart2,        hint: "Performance insights" },
  { label: "Messages",      href: "/messages",   icon: MessageSquare,    hint: "Team chat" },
  { label: "Support Team",  href: "/users",      icon: Users,            hint: "Agents & roles" },
  { label: "Settings",      href: "/settings",   icon: Settings,         hint: "Preferences" },
];

const QUICK_ACTIONS = [
  { label: "New Ticket",    href: "/tickets?new=1",  icon: Plus,        hint: "Create a support ticket" },
  { label: "New Customer",  href: "/customers",      icon: UserCircle,  hint: "Add a client account" },
];

// Highlight matching characters in a string
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-purple-600 font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function CommandPalette({ open, onClose }: Props) {
  const { tickets, customers } = useData();
  const [query, setQuery]           = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const router    = useRouter();
  const q         = query.trim().toLowerCase();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Result sets ─────────────────────────────────────────────────────────────

  const customerResults = q
    ? customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.clientId.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      ).slice(0, 5)
    : customers.slice(0, 3);

  const ticketResults = q
    ? tickets.filter(t =>
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.issue.toLowerCase().includes(q) ||
        t.clientId.toLowerCase().includes(q)
      ).slice(0, 5)
    : tickets.slice(0, 3);

  const pageResults = q
    ? PAGE_SHORTCUTS.filter(p => p.label.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q))
    : [];

  // Flat list of all selectable items for keyboard nav
  type Item =
    | { kind: "page";     href: string }
    | { kind: "action";   href: string }
    | { kind: "customer"; href: string }
    | { kind: "ticket";   href: string };

  const allItems: Item[] = [
    ...(q ? pageResults.map(p => ({ kind: "page" as const,     href: p.href })) : []),
    ...(q ? QUICK_ACTIONS.filter(a => a.label.toLowerCase().includes(q)).map(a => ({ kind: "action" as const, href: a.href })) : []),
    ...(!q ? QUICK_ACTIONS.map(a => ({ kind: "action" as const, href: a.href })) : []),
    ...customerResults.map(c  => ({ kind: "customer" as const, href: `/customers/${c.clientId}` })),
    ...ticketResults.map(t    => ({ kind: "ticket" as const,   href: `/tickets?open=${t.id}` })),
  ];

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, allItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && allItems[activeIndex]) { navigate(allItems[activeIndex].href); }
    else if (e.key === "Escape") { onClose(); }
  }

  if (!open) return null;

  let flatIdx = 0;

  // Helper: returns data-idx and active style for a row
  function rowProps(idx: number) {
    const active = activeIndex === idx;
    return {
      "data-idx": idx,
      style: { background: active ? "var(--surface-low)" : "transparent" },
      onMouseEnter: () => setActiveIndex(idx),
    };
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }} onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden z-10"
        style={{ background: "var(--surface-lowest)", boxShadow: "0 32px 100px 0 rgba(0,0,0,0.28)" }}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(204,195,215,0.15)" }}>
          <Search size={16} className="text-[#48484a] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tickets, customers, pages…"
            className="flex-1 bg-transparent text-sm text-[#1a1c1c] outline-none placeholder:text-[#48484a]"
          />
          {query
            ? <button onClick={() => setQuery("")} className="text-[#48484a] hover:text-[#1a1c1c] transition-colors"><X size={14} /></button>
            : <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#48484a]" style={{ background: "var(--surface-low)" }}>⌘K</kbd>
          }
        </div>

        {/* Results */}
        <div ref={listRef} className="p-2 max-h-[420px] overflow-y-auto">

          {/* No results */}
          {q && allItems.length === 0 && (
            <p className="py-10 text-center text-sm text-[#48484a]">No results for &ldquo;{query}&rdquo;</p>
          )}

          {/* Page shortcuts (search only) */}
          {q && pageResults.length > 0 && (
            <section className="mb-1">
              <p className="text-label-caps text-[#48484a] px-3 pt-2 pb-1.5">Pages</p>
              {pageResults.map(p => {
                const Icon = p.icon;
                const idx  = flatIdx++;
                return (
                  <button key={p.href} onClick={() => navigate(p.href)}
                    {...rowProps(idx)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--surface-low)" }}>
                      <Icon size={13} className="text-[#48484a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1a1c1c]"><Highlight text={p.label} query={query} /></p>
                      <p className="text-xs text-[#48484a]">{p.hint}</p>
                    </div>
                    <ArrowRight size={12} className="text-[#48484a] flex-shrink-0" />
                  </button>
                );
              })}
            </section>
          )}

          {/* Quick actions */}
          {(!q || QUICK_ACTIONS.some(a => a.label.toLowerCase().includes(q))) && (
            <section className="mb-1">
              <p className="text-label-caps text-[#48484a] px-3 pt-2 pb-1.5">Quick Actions</p>
              {QUICK_ACTIONS
                .filter(a => !q || a.label.toLowerCase().includes(q))
                .map(a => {
                  const Icon = a.icon;
                  const idx  = flatIdx++;
                  return (
                    <button key={a.href} onClick={() => navigate(a.href)}
                      {...rowProps(idx)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all">
                      <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                        <Icon size={13} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1c1c]"><Highlight text={a.label} query={query} /></p>
                        <p className="text-xs text-[#48484a]">{a.hint}</p>
                      </div>
                      <ArrowRight size={12} className="text-[#48484a] flex-shrink-0" />
                    </button>
                  );
                })}
            </section>
          )}

          {/* Customers */}
          {customerResults.length > 0 && (
            <section className="mb-1">
              <p className="text-label-caps text-[#48484a] px-3 pt-2 pb-1.5">
                {q ? "Customers" : "Recent Customers"}
              </p>
              {customerResults.map(c => {
                const idx      = flatIdx++;
                const initials = c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
                return (
                  <button key={c.clientId} onClick={() => navigate(`/customers/${c.clientId}`)}
                    {...rowProps(idx)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all">
                    <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1a1c1c]"><Highlight text={c.name} query={query} /></p>
                      <p className="text-xs text-[#48484a]">
                        <Highlight text={c.clientId} query={query} /> · {c.country}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.accountType === "VIP" ? "bg-purple-50 text-purple-700" :
                        c.accountType === "Premium" ? "bg-blue-50 text-blue-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{c.accountType}</span>
                    </div>
                  </button>
                );
              })}
            </section>
          )}

          {/* Tickets */}
          {ticketResults.length > 0 && (
            <section>
              <p className="text-label-caps text-[#48484a] px-3 pt-2 pb-1.5">
                {q ? "Tickets" : "Recent Tickets"}
              </p>
              {ticketResults.map(t => {
                const idx = flatIdx++;
                return (
                  <button key={t.id} onClick={() => navigate(`/tickets?open=${t.id}`)}
                    {...rowProps(idx)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <TicketIcon size={14} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-bold text-purple-600"><Highlight text={t.id} query={query} /></p>
                        <PriorityPill priority={t.priority} />
                        <StatusPill status={t.status} />
                      </div>
                      <p className="text-xs text-[#48484a] truncate">
                        <Highlight text={t.customer} query={query} /> — {t.issue}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#48484a] flex-shrink-0 ml-1">{t.agent}</span>
                  </button>
                );
              })}
            </section>
          )}

          {/* Default empty state — page shortcuts */}
          {!q && (
            <section className="mt-1">
              <p className="text-label-caps text-[#48484a] px-3 pt-2 pb-1.5">Navigate</p>
              <div className="grid grid-cols-2 gap-1 px-1">
                {PAGE_SHORTCUTS.map(p => {
                  const Icon = p.icon;
                  const idx  = flatIdx++;
                  return (
                    <button key={p.href} onClick={() => navigate(p.href)}
                      {...rowProps(idx)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all">
                      <Icon size={13} className="text-[#48484a] flex-shrink-0" />
                      <span className="text-sm text-[#1a1c1c]">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-5 py-2.5"
          style={{ borderTop: "1px solid rgba(204,195,215,0.12)", background: "var(--surface-low)" }}>
          <span className="text-[11px] text-[#48484a]">↑↓ navigate</span>
          <span className="text-[11px] text-[#48484a]">↵ open</span>
          <span className="text-[11px] text-[#48484a]">esc close</span>
          {q && <span className="ml-auto text-[11px] text-[#48484a]">{allItems.length} result{allItems.length !== 1 ? "s" : ""}</span>}
        </div>
      </div>
    </div>
  );
}
