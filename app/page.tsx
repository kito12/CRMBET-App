"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { Clock, CheckCircle2, AlertCircle, ShieldAlert, UserX, Users, ArrowRight, Zap, X, Crown } from "lucide-react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SkeletonCard, SkeletonTableRow, SkeletonLine } from "@/components/ui/Skeleton";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/data";

// ─── Random ticket generator ─────────────────────────────────────────────────
const ISSUES    = ["Withdrawal Issue", "Restricted Withdrawals", "Deposits", "Blocked Accounts", "Bet Settlement", "Account Access", "Bonus Dispute", "Live Betting", "Other"];
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
  const { tickets, setTickets, customers, hydrated, slaPolicy } = useData();
  const { user: currentUser } = useAuth();
  const [agentCount, setAgentCount] = useState(0);
  const [liveMode, setLiveMode]   = useState(false);
  const [toast, setToast]         = useState<Ticket | null>(null);
  const [liveItems, setLiveItems] = useState<{ text: string; relTime: string; dot: string; rawTs: number }[]>([]);
  const liveRef = useRef(liveMode);
  liveRef.current = liveMode;

  // Real agent count from Firestore users collection
  useEffect(() => {
    return onSnapshot(collection(db, "users"), snap => {
      setAgentCount(snap.size);
    });
  }, []);

  // Computed stats — memoized so they only recalculate when tickets/customers/slaPolicy actually change
  const dashStats = useMemo(() => {
    const openCount     = tickets.filter(t => t.status === "Open").length;
    const resolvedCount = tickets.filter(t => t.status === "Resolved").length;
    const unassignedCount = tickets.filter(t => t.agent === "Unassigned" && t.status !== "Resolved").length;
    const recentTickets = [...tickets].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);

    // SLA breach count — tickets currently over their SLA target
    const now = Date.now();
    const slaBreachCount = tickets.filter(t => {
      if (t.status === "Resolved" || t.status === "On Hold") return false;
      const policy = slaPolicy[t.priority];
      const d = t.createdAt ? new Date(t.createdAt) : null;
      if (!d) return false;
      const elapsedMs = now - d.getTime();
      const targetMs  = (t.status === "Open" ? policy.firstReplyMinutes : policy.resolutionMinutes) * 60_000;
      return elapsedMs > targetMs;
    }).length;

    // Avg first reply time from real data
    const repliedTickets = tickets.filter(t => t.firstRepliedAt && t.createdAt);
    const avgReplyMs = repliedTickets.length === 0 ? null
      : repliedTickets.reduce((sum, t) => sum + (new Date(t.firstRepliedAt!).getTime() - new Date(t.createdAt!).getTime()), 0) / repliedTickets.length;
    const avgReplyLabel = avgReplyMs === null ? "--"
      : avgReplyMs < 60_000 ? `${Math.round(avgReplyMs / 1000)}s`
      : avgReplyMs < 3_600_000 ? `${Math.round(avgReplyMs / 60_000)}m`
      : `${(avgReplyMs / 3_600_000).toFixed(1)}h`;

    // My queue — tickets assigned to current agent that are active
    const myQueue = tickets
      .filter(t => t.agent === currentUser?.name && (t.status === "Open" || t.status === "In Progress"))
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 5);

    // Issue breakdown percentages
    const total = tickets.length || 1;
    const issuePcts = [
      { label: "Withdrawal",          color: "bg-purple-500", count: tickets.filter(t => t.issue === "Withdrawal Issue").length },
      { label: "Restr. Withdrawals",  color: "bg-purple-400", count: tickets.filter(t => t.issue === "Restricted Withdrawals").length },
      { label: "Deposits",            color: "bg-blue-400",   count: tickets.filter(t => t.issue === "Deposits").length },
      { label: "Blocked Accounts",    color: "bg-red-400",    count: tickets.filter(t => t.issue === "Blocked Accounts").length },
      { label: "Bet Settlement",      color: "bg-blue-500",   count: tickets.filter(t => t.issue === "Bet Settlement").length },
      { label: "Account Access",      color: "bg-indigo-400", count: tickets.filter(t => t.issue === "Account Access").length },
      { label: "Bonus Dispute",       color: "bg-violet-300", count: tickets.filter(t => t.issue === "Bonus Dispute").length },
      { label: "Live Betting",        color: "bg-purple-200", count: tickets.filter(t => t.issue === "Live Betting").length },
    ].filter(x => x.count > 0)
     .map(x => ({ ...x, pct: Math.round((x.count / total) * 100) }))
     .sort((a, b) => b.pct - a.pct);

    // Sparkline: last 7 "days" based on ticket IDs bucketed into groups of 2
    const buckets   = 7;
    const sorted    = [...tickets].sort((a, b) => a.id.localeCompare(b.id));
    const chunkSize = Math.max(1, Math.ceil(sorted.length / buckets));
    const sparkData = Array.from({ length: buckets }, (_, i) =>
      sorted.slice(i * chunkSize, (i + 1) * chunkSize).length
    );

    return { openCount, resolvedCount, unassignedCount, slaBreachCount, avgReplyLabel, myQueue, recentTickets, issuePcts, sparkData };
  }, [tickets, slaPolicy, currentUser?.name]);

  const { openCount, resolvedCount, unassignedCount, slaBreachCount, avgReplyLabel, myQueue, recentTickets, issuePcts, sparkData } = dashStats;

  // Computed feed from real ticket audit logs
  const computedFeed = useMemo(() => {
    type FeedItem = { text: string; relTime: string; dot: string; rawTs: number };
    const now = Date.now();
    const events: FeedItem[] = [];

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

    function relTime(ms: number): string {
      const diff = Math.floor((now - ms) / 60000);
      if (diff < 1) return "just now";
      if (diff < 60) return `${diff}m ago`;
      const h = Math.floor(diff / 60);
      if (h < 24) return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    }

    tickets.forEach(ticket => {
      (ticket.auditLog ?? []).forEach(entry => {
        let text = "";
        let dot = "bg-slate-400";
        switch (entry.action) {
          case "created":
            text = `${ticket.id} opened for ${ticket.customer}`;
            dot = ticket.priority === "High" ? "bg-red-400" : "bg-purple-400";
            break;
          case "status_changed":
            text = `${ticket.id} marked ${entry.to} by ${entry.author}`;
            dot = entry.to === "Resolved" ? "bg-emerald-400" : "bg-blue-400";
            break;
          case "agent_changed":
            text = `${ticket.id} reassigned to ${entry.to}`;
            dot = "bg-purple-400";
            break;
          case "escalated":
            text = `${ticket.id} escalated to ${entry.to}`;
            dot = "bg-amber-400";
            break;
          case "priority_changed":
            text = `${ticket.id} priority → ${entry.to}`;
            dot = "bg-orange-400";
            break;
        }
        if (text) {
          const rawTs = parseTs(entry.timestamp);
          events.push({ text, relTime: relTime(rawTs), dot, rawTs });
        }
      });
      // Fallback for tickets with no auditLog: show ticket creation
      if (!ticket.auditLog?.length) {
        const rawTs = parseTs(ticket.created);
        events.push({
          text: `${ticket.id} created for ${ticket.customer}`,
          relTime: relTime(rawTs),
          dot: ticket.priority === "High" ? "bg-red-400" : "bg-purple-400",
          rawTs,
        });
      }
    });

    return events.sort((a, b) => b.rawTs - a.rawTs).slice(0, 8);
  }, [tickets]);

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
        const now = new Date();
        const newTicket: Ticket = {
          id: `TKT-${now.getTime()}`, clientId: c.clientId, customer: c.name,
          email: c.email, phone: c.phone, issue, priority,
          status: "Open" as TicketStatus, agent: "Unassigned",
          created: nowLabel(), createdAt: now.toISOString(),
        };
        setToast(newTicket);
        setLiveItems(prev => [{
          text: `New ticket ${newTicket.id} from ${c.name}`,
          relTime: "just now",
          dot: priority === "High" ? "bg-red-400" : "bg-purple-400",
          rawTs: Date.now()
        }, ...prev].slice(0, 4));
        return [newTicket, ...prev];
      });
    }, 12000);
    return () => clearInterval(id);
  }, [liveMode, customers, setTickets]);

  const displayFeed = [...liveItems, ...computedFeed].slice(0, 8);

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

      {/* VIP alert strip — shown when there are open tickets from VIP customers */}
      {hydrated && (() => {
        const vipClientIds = new Set(customers.filter(c => c.accountType === "VIP").map(c => c.clientId));
        const vipOpen = tickets.filter(t => t.status !== "Resolved" && vipClientIds.has(t.clientId));
        if (vipOpen.length === 0) return null;
        const vipHigh = vipOpen.filter(t => t.priority === "High").length;
        const vipUnassigned = vipOpen.filter(t => t.agent === "Unassigned").length;
        return (
          <Link href="/tickets?status=Open"
            className="flex items-center gap-4 p-4 mb-6 rounded-2xl transition-all hover:opacity-95"
            style={{
              background: "linear-gradient(135deg, rgba(113,49,214,0.08), rgba(0,88,191,0.08))",
              border: "1px solid rgba(113,49,214,0.2)",
            }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 gradient-primary">
              <Crown size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1a1c1c]">
                {vipOpen.length} open VIP ticket{vipOpen.length !== 1 ? "s" : ""} — needs priority attention
              </p>
              <p className="text-xs text-[#48484a] mt-0.5">
                {vipHigh} high priority · {vipUnassigned} unassigned
              </p>
            </div>
            <ArrowRight size={16} className="text-purple-600 flex-shrink-0" />
          </Link>
        );
      })()}

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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: AlertCircle,  label: "OPEN",         value: String(openCount),      sub: "currently active",                   color: "text-purple-600",  bg: "bg-purple-50",  spark: sparkData, href: "/tickets?status=Open" },
                  { icon: CheckCircle2, label: "RESOLVED",     value: String(resolvedCount),  sub: "tickets closed",                     color: "text-emerald-600", bg: "bg-emerald-50", spark: null,      href: "/tickets?status=Resolved" },
                  { icon: ShieldAlert,  label: "SLA BREACHES", value: String(slaBreachCount), sub: slaBreachCount === 0 ? "all on track" : "need attention",       color: slaBreachCount > 0 ? "text-red-600" : "text-emerald-600", bg: slaBreachCount > 0 ? "bg-red-50" : "bg-emerald-50", spark: null, href: "/tickets" },
                  { icon: UserX,        label: "UNASSIGNED",   value: String(unassignedCount),sub: unassignedCount === 0 ? "queue clear" : "need assignment",       color: unassignedCount > 0 ? "text-amber-600" : "text-emerald-600", bg: unassignedCount > 0 ? "bg-amber-50" : "bg-emerald-50", spark: null, href: "/tickets" },
                ].map(({ icon: Icon, label, value, sub, color, bg, spark, href }) => (
                  <Link key={label} href={href}
                    className="rounded-xl p-4 group transition-all duration-150 hover:scale-[1.02] hover:shadow-md cursor-pointer"
                    style={{ background: "var(--surface-low)" }}>
                    <div className="flex items-start justify-between">
                      <div className={`inline-flex p-2 rounded-lg ${bg} mb-3 transition-transform duration-150 group-hover:scale-110`}>
                        <Icon size={16} className={color} />
                      </div>
                      {spark && <Sparkline data={spark} color="#7131d6" width={80} height={28} />}
                    </div>
                    <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
                    <p className="text-2xl font-bold text-[#1a1c1c] tracking-tight">{value}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-[#48484a]">{sub}</p>
                      <ArrowRight size={12} className="text-[#48484a] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-150" />
                    </div>
                  </Link>
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
              { icon: Users, label: "TEAM",        value: String(agentCount),   sub: agentCount === 1 ? "agent registered" : "agents registered", color: "text-purple-600", bg: "bg-purple-50", href: "/users" },
              { icon: Clock, label: "AVG REPLY",   value: avgReplyLabel,        sub: avgReplyLabel === "--" ? "no data yet" : "first response time", color: "text-blue-600",  bg: "bg-blue-50",  href: "/analytics" },
            ].map(({ icon: Icon, label, value, sub, color, bg, href }) => (
              <Link key={label} href={href}
                className="rounded-2xl p-5 group transition-all duration-150 hover:scale-[1.02] hover:shadow-md cursor-pointer"
                style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
                <div className={`inline-flex p-2 rounded-lg ${bg} mb-3 transition-transform duration-150 group-hover:scale-110`}>
                  <Icon size={16} className={color} />
                </div>
                <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
                <p className="text-2xl font-bold text-[#1a1c1c] tracking-tight">{value}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-[#48484a]">{sub}</p>
                  <ArrowRight size={11} className="text-[#48484a] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-150" />
                </div>
              </Link>
            ))}
          </div>

          {/* My Queue */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-label-caps text-[#48484a] mb-1">Assigned to me</p>
                <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight">My Queue</h3>
              </div>
              <Link href="/tickets?agentView=Mine"
                className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {!hydrated ? (
              <div className="flex flex-col gap-2">
                {[1,2,3].map(i => <SkeletonTableRow key={i} cols={2} />)}
              </div>
            ) : myQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle2 size={28} className="text-emerald-400" />
                <p className="text-sm font-medium text-[#1a1c1c]">Queue clear!</p>
                <p className="text-xs text-[#48484a]">No open tickets assigned to you</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {myQueue.map(t => (
                  <Link key={t.id} href={`/tickets?open=${t.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={{ background: "var(--surface-low)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-lowest)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-low)")}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.priority === "High" ? "bg-red-400" : t.priority === "Medium" ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-purple-600">{t.id}</p>
                      <p className="text-xs text-[#1a1c1c] truncate">{t.customer} — {t.issue}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      t.status === "Open" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                    }`}>{t.status}</span>
                  </Link>
                ))}
              </div>
            )}
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
              {displayFeed.map((item, i) => (
                <div key={i} className={`flex items-start gap-3 ${i === 0 && liveMode && liveItems.length > 0 ? "slide-in" : ""}`}>
                  <span className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${item.dot}`} />
                  <div>
                    <p className="text-sm text-[#1a1c1c] leading-relaxed">{item.text}</p>
                    <p className="text-xs text-[#48484a]">{item.relTime}</p>
                  </div>
                </div>
              ))}
              {displayFeed.length === 0 && (
                <p className="text-sm text-[#48484a] text-center py-4">No activity yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && <LiveToast ticket={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
