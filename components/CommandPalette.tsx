"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, ArrowRight, Ticket as TicketIcon, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { customers, tickets } from "@/lib/data";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const customerResults = query.trim()
    ? customers.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.clientId.toLowerCase().includes(query.toLowerCase()) ||
        c.email.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 4)
    : customers.slice(0, 3);

  const ticketResults = query.trim()
    ? tickets.filter(t =>
        t.id.toLowerCase().includes(query.toLowerCase()) ||
        t.customer.toLowerCase().includes(query.toLowerCase()) ||
        t.issue.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 4)
    : tickets.slice(0, 3);

  type ResultItem = { type: "customer" | "ticket"; key: string; primary: string; secondary: string; href: string; initials?: string };

  const results: ResultItem[] = [
    ...customerResults.map(c => ({
      type: "customer" as const,
      key: c.clientId,
      primary: c.name,
      secondary: c.clientId + " · " + c.country,
      href: `/customers/${c.clientId}`,
      initials: c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2),
    })),
    ...ticketResults.map(t => ({
      type: "ticket" as const,
      key: t.id,
      primary: t.id,
      secondary: t.customer + " — " + t.issue,
      href: "/tickets",
    })),
  ];

  useEffect(() => { setActiveIndex(0); }, [query]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[activeIndex]) { navigate(results[activeIndex].href); }
    else if (e.key === "Escape") { onClose(); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }} onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden z-10"
        style={{ background: "var(--surface-lowest)", boxShadow: "0 32px 100px 0 rgba(0,0,0,0.25)" }}>

        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(204,195,215,0.15)" }}>
          <Search size={16} className="text-[#48484a] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search customers, tickets..."
            className="flex-1 bg-transparent text-sm text-[#1a1c1c] outline-none placeholder:text-[#48484a]"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[#48484a] hover:text-[#1a1c1c] transition-colors">
              <X size={14} />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#48484a]" style={{ background: "var(--surface-low)" }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="p-2 max-h-[360px] overflow-y-auto">
          {results.length === 0 && (
            <p className="py-8 text-center text-sm text-[#48484a]">No results for &ldquo;{query}&rdquo;</p>
          )}

          {customerResults.length > 0 && (
            <>
              <p className="text-label-caps text-[#48484a] px-3 pt-2 pb-1">{query ? "Customers" : "Recent Customers"}</p>
              {customerResults.map((c, i) => (
                <button key={c.clientId} onClick={() => navigate(`/customers/${c.clientId}`)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{ background: activeIndex === i ? "var(--surface-low)" : "transparent" }}>
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1a1c1c]">{c.name}</p>
                    <p className="text-xs text-[#48484a]">{c.clientId} · {c.country}</p>
                  </div>
                  <UserCircle size={13} className="text-[#48484a]" />
                </button>
              ))}
            </>
          )}

          {ticketResults.length > 0 && (
            <>
              <p className="text-label-caps text-[#48484a] px-3 pt-3 pb-1">{query ? "Tickets" : "Recent Tickets"}</p>
              {ticketResults.map((t, i) => {
                const idx = customerResults.length + i;
                return (
                  <button key={t.id} onClick={() => navigate("/tickets")}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{ background: activeIndex === idx ? "var(--surface-low)" : "transparent" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-50">
                      <TicketIcon size={13} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-purple-600">{t.id}</p>
                      <p className="text-xs text-[#48484a] truncate">{t.customer} — {t.issue}</p>
                    </div>
                    <ArrowRight size={13} className="text-[#48484a]" />
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-5 py-2.5" style={{ borderTop: "1px solid rgba(204,195,215,0.12)", background: "var(--surface-low)" }}>
          <span className="text-[11px] text-[#48484a]">↑↓ navigate</span>
          <span className="text-[11px] text-[#48484a]">↵ open</span>
          <span className="text-[11px] text-[#48484a]">esc close</span>
          <span className="ml-auto text-[11px] text-[#48484a]">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
