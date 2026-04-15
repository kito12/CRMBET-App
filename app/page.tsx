"use client";

import { useState, useEffect, useRef } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { Clock, CheckCircle2, AlertCircle, TrendingUp, Users, ArrowRight, Zap, X } from "lucide-react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { SkeletonCard, SkeletonTableRow, SkeletonLine } from "@/components/ui/Skeleton";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/data";

// ─── Static activity feed ────────────────────────────────────────────────────
const BASE_FEED = [
  { text: "TKT-1041 escalated to Tier 2",           time: "2m ago",  dot: "bg-amber-400" },
  { text: "Sarah K. resolved TKT-1038",              time: "2h ago",  dot: "bg-emerald-400" },
  { text: "New high-priority ticket from Leo F.",    time: "28m ago", dot: "bg-red-400" },
  { text: "Avg response dipped below SLA",           time: "1h ago",  dot: "bg-purple-400" },
  { text: "James R. came online",                    time: "3h ago",  dot: "bg-blue-400" },
];

// ─── Random ticket generator ─────────────────────────────────────────────────
const ISSUES    = ["Withdrawal Issue", "Bet Settlement", "Account Access", "Bonus Dispute", "Live Betting"];
const PRIOS     = ["High", "Medium", "Low"] as TicketPriority[];
const MONTHS    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function nowLabel() {
  const n = new Date();
  return `${MONTHS[n.getMonth()]} ${n.getDate()}, ${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}

// ─── SVG Sparkline ────────────────────────────────────────────────────────────
function Sparkline({ data, color = "#7131d6", width = 120, height = 36 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const max  = Math.max(...data, 1);
  const min  = Math.min(...data);
  const range = max - min || 1;
  const pad  = 2;
  const xs   = data.map((_, i) => pad + (i / (data.length - 1)) * (width - pad * 2));
  const ys   = data.map(v => height - pad - ((v - min) / range) * (height - pad * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${path} L${xs[xs.length-1]},${height} L${xs[0]},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <path d={area} fill={color} opacity="0.12" />
      <path d={path} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* last point dot */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill={color} />
    </svg>
  );
}

// ─── Issue bar ────────────────────────────────────────────────────────────────
function IssueBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-[#1a1c1c]">{label}</span>
        <span className="text-xs text-[#48484a]">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-low)" }}>
        <div className={`h-1.5 rounded-full bar-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Toast notification ───────────────────────────────────────────────────────
function LiveToast({ ticket, onDismiss }: { ticket: Ticket; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="slide-in fixed bottom-24 md:bottom-6 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
      style={{ background: "var(--surface-lowest)", boxShadow: "0 16px 48px rgba(26,28,28,0.18)", border: "1px solid rgba(113,49,214,0.15)" }}>
      <span className="w-2 h-2 rounded-full bg-red-500 live-dot flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-purple-600">{ticket.id} · {ticket.priority} priority</p>
        <p className="text-xs text-[#48484a] truncate max-w-[200px]">{ticket.customer} — {ticket.issue}</p>
      </div>
      <button onClick={onDismiss} className="text-[#48484a] hover:text-[#1a1c1c] transition-colors flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { tickets, setTickets, customers, hydrated } = useData();
  const [liveMode, setLiveMode]   = useState(false);
  const [toast, setToast]         = useState<Ticket | null>(null);
  const [feed, setFeed]           = useState(BASE_FEED);
  const liveRef = useRef(liveMode);
  liveRef.current = liveMode;

  // Computed stats
  const openCount     = tickets.filter(t => t.status === "Open").length;
  const resolvedCount = tickets.filter(t => t.status === "Resolved").length;
  const recentTickets = [...tickets].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);

  // Issue breakdown percentages
  const total = tickets.length || 1;
  const issuePcts = [
    { label: "Withdrawal",    color: "bg-purple-500", count: tickets.filter(t => t.issue === "Withdrawal Issue").length },
    { label: "Bet Settlement",color: "bg-blue-500",   count: tickets.filter(t => t.issue === "Bet Settlement").length },
    { label: "Account Access",color: "bg-indigo-400", count: tickets.filter(t => t.issue === "Account Access").length },
    { label: "Bonus Dispute", color: "bg-violet-300", count: tickets.filter(t => t.issue === "Bonus Dispute").length },
    { label: "Live Betting",  color: "bg-purple-200", count: tickets.filter(t => t.issue === "Live Betting").length },
  ].map(x => ({ ...x, pct: Math.round((x.count / total) * 100) }))
   .sort((a, b) => b.pct - a.pct);

  // Sparkline: last 7 "days" based on ticket IDs bucketed into groups of 2
  const buckets = 7;
  const sorted  = [...tickets].sort((a, b) => a.id.localeCompare(b.id));
  const chunkSize = Math.max(1, Math.ceil(sorted.length / buckets));
  const sparkData = Array.from({ length: buckets }, (_, i) =>
    sorted.slice(i * chunkSize, (i + 1) * chunkSize).length
  );

  // Live simulation
  useEffect(() => {
    if (!liveMode) return;
    const id = setInterval(() => {
      if (!liveRef.current) return;
      const c = customers[Math.floor(Math.random() * customers.length)];
      if (!c) return;
      const issue    = ISSUES[Math.floor(Math.random() * ISSUES.length)];
      const priority = PRIOS[Math.floor(Math.random() * PRIOS.length)];

      setTickets(prev => {
        const maxNum = Math.max(...prev.map(t => parseInt(t.id.replace("TKT-", ""))));
        const newTicket: Ticket = {
          id: `TKT-${maxNum + 1}`, clientId: c.clientId, customer: c.name,
          email: c.email, phone: c.phone, issue, priority,
          status: "Open" as TicketStatus, agent: "Unassigned", created: nowLabel(),
        };
        setToast(newTicket);
        setFeed(f => [{ text: `New ticket ${newTicket.id} from ${c.name}`, time: "just now", dot: priority === "High" ? "bg-red-400" : "bg-purple-400" }, ...f.slice(0, 4)]);
        return [newTicket, ...prev];
      });
    }, 12000);
    return () => clearInterval(id);
  }, [liveMode, customers, setTickets]);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-label-caps text-[#48484a] mb-1">Overview</p>
          <h1 className="text-display text-[#1a1c1c]">Dashboard</h1>
        </div>
        {/* Live mode toggle */}
        <button onClick={() => setLiveMode(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            liveMode
              ? "text-white gradient-primary shadow-ambient"
              : "text-[#48484a] hover:bg-[#f3f3f3]"
          }`}
          style={!liveMode ? { background: "var(--surface-lowest)", border: "1px solid rgba(204,195,215,0.3)" } : {}}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${liveMode ? "bg-white live-dot" : "bg-slate-300"}`} />
          {liveMode ? "Live — new ticket in ~12s" : "Enable Live Feed"}
        </button>
      </div>

      {/* 60/40 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* LEFT — 60% */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Hero summary card */}
          <div className="rounded-2xl p-7" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-label-caps text-[#48484a] mb-1">Today at a glance</p>
                <h2 className="text-headline text-[#1a1c1c]">Support Overview</h2>
              </div>
              <Link href="/tickets"
                className="gradient-primary text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-opacity">
                All Tickets <ArrowRight size={14} />
              </Link>
            </div>

            {!hydrated ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1,2,3].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: AlertCircle,  label: "OPEN TICKETS",  value: String(openCount),     sub: "currently active",  color: "text-purple-600",  bg: "bg-purple-50",  spark: sparkData },
                  { icon: CheckCircle2, label: "RESOLVED",      value: String(resolvedCount), sub: "tickets closed",    color: "text-emerald-600", bg: "bg-emerald-50", spark: null },
                  { icon: Clock,        label: "AVG RESPONSE",  value: "8m",                  sub: "SLA target: 10m",   color: "text-blue-600",    bg: "bg-blue-50",    spark: null },
                ].map(({ icon: Icon, label, value, sub, color, bg, spark }) => (
                  <div key={label} className="rounded-xl p-4" style={{ background: "var(--surface-low)" }}>
                    <div className="flex items-start justify-between">
                      <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
                        <Icon size={16} className={color} />
                      </div>
                      {spark && <Sparkline data={spark} color="#7131d6" width={80} height={28} />}
                    </div>
                    <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
                    <p className="text-2xl font-bold text-[#1a1c1c] tracking-tight">{value}</p>
                    <p className="text-xs text-[#48484a] mt-1">{sub}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent tickets */}
          <div className="rounded-2xl p-7" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-label-caps text-[#48484a] mb-1">Queue</p>
                <h2 className="text-xl font-semibold text-[#1a1c1c] tracking-tight">Recent Tickets</h2>
              </div>
              <Link href="/tickets" className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1">
                View all <ArrowRight size={13} />
              </Link>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_1.4fr_1.4fr_1fr_0.7fr] gap-3 px-3 mb-1">
                {["TICKET", "CUSTOMER", "ISSUE", "STATUS", "AGENT"].map(h => (
                  <span key={h} className="text-label-caps text-[#48484a]">{h}</span>
                ))}
              </div>
              {!hydrated
                ? [1,2,3,4,5,6].map(i => <SkeletonTableRow key={i} cols={5} />)
                : recentTickets.map((ticket, i) => (
                  <Link key={ticket.id} href="/tickets"
                    className={`grid grid-cols-[1fr_1.4fr_1.4fr_1fr_0.7fr] gap-3 items-center px-3 py-3 rounded-xl transition-all duration-150 ${i === 0 && liveMode ? "slide-in" : ""}`}
                    style={{ background: "var(--surface-low)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-lowest)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-low)")}>
                    <span className="text-sm font-medium text-purple-600">{ticket.id}</span>
                    <span className="text-sm text-[#1a1c1c]">{ticket.customer}</span>
                    <span className="text-sm text-[#48484a]">{ticket.issue}</span>
                    <StatusPill status={ticket.status} />
                    <span className="text-xs text-[#48484a]">{ticket.agent}</span>
                  </Link>
                ))
              }
            </div>
            {/* Mobile cards */}
            <div className="flex sm:hidden flex-col gap-2">
              {!hydrated
                ? [1,2,3].map(i => <SkeletonTableRow key={i} cols={3} />)
                : recentTickets.map((ticket, i) => (
                  <Link key={ticket.id} href="/tickets"
                    className={`flex items-center justify-between px-3 py-3 rounded-xl ${i === 0 && liveMode ? "slide-in" : ""}`}
                    style={{ background: "var(--surface-low)" }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-purple-600">{ticket.id}</span>
                        <StatusPill status={ticket.status} />
                      </div>
                      <p className="text-sm text-[#1a1c1c] truncate">{ticket.customer}</p>
                      <p className="text-xs text-[#48484a]">{ticket.issue} · {ticket.agent}</p>
                    </div>
                    <span className="text-xs text-[#48484a] flex-shrink-0 ml-2">{ticket.created}</span>
                  </Link>
                ))
              }
            </div>
          </div>
        </div>

        {/* RIGHT — 40% */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-4">
            {!hydrated ? (
              <><SkeletonCard /><SkeletonCard /></>
            ) : [
              { icon: Users,      label: "ACTIVE AGENTS", value: "12", sub: "of 18 online",        color: "text-purple-600", bg: "bg-purple-50" },
              { icon: TrendingUp, label: "CSAT SCORE",    value: "94%", sub: "↑ 2pts this week",   color: "text-blue-600",   bg: "bg-blue-50" },
            ].map(({ icon: Icon, label, value, sub, color, bg }) => (
              <div key={label} className="rounded-2xl p-5" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
                <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
                  <Icon size={16} className={color} />
                </div>
                <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
                <p className="text-2xl font-bold text-[#1a1c1c] tracking-tight">{value}</p>
                <p className="text-xs text-[#48484a] mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Issue breakdown — animated bars */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <p className="text-label-caps text-[#48484a] mb-1">Breakdown</p>
            <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-5">By Issue Type</h3>
            {!hydrated
              ? [1,2,3,4,5].map(i => (
                  <div key={i} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <SkeletonLine className="w-28" />
                      <SkeletonLine className="w-8" />
                    </div>
                    <div className="skeleton h-1.5 rounded-full w-full" />
                  </div>
                ))
              : issuePcts.map(({ label, pct, color }) => (
                  <IssueBar key={label} label={label} pct={pct} color={color} />
                ))
            }
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-label-caps text-[#48484a] mb-1">Live</p>
                <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight">Activity Feed</h3>
              </div>
              {liveMode && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(113,49,214,0.08)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 live-dot" />
                  <span className="text-[10px] font-semibold text-purple-600">LIVE</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {feed.map((item, i) => (
                <div key={i} className={`flex items-start gap-3 ${i === 0 && liveMode && feed[0].time === "just now" ? "slide-in" : ""}`}>
                  <span className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${item.dot}`} />
                  <div>
                    <p className="text-sm text-[#1a1c1c] leading-relaxed">{item.text}</p>
                    <p className="text-xs text-[#48484a]">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && <LiveToast ticket={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
