"use client";

import { useRef, useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { Ticket, CheckCircle2, AlertCircle, TrendingUp, Users, Clock, CalendarDays, Download } from "lucide-react";
import type { Ticket as TicketType } from "@/lib/data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function avgResolutionMs(resolvedTickets: TicketType[]): number | null {
  const times = resolvedTickets
    .filter(t => t.resolvedAt && t.createdAt)
    .map(t => new Date(t.resolvedAt!).getTime() - new Date(t.createdAt!).getTime())
    .filter(ms => ms > 0);
  if (times.length === 0) return null;
  return times.reduce((s, t) => s + t, 0) / times.length;
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60)  return `${mins}m`;
  const hrs = mins / 60;
  if (hrs < 24)   return `${hrs.toFixed(1)}h`;
  return `${(hrs / 24).toFixed(1)}d`;
}

function parseCreatedToDate(created: string): Date | null {
  try {
    const m = created.match(/^(\w{3})\s+(\d+),\s+(\d{2}):(\d{2})$/);
    if (!m) return null;
    const months: Record<string, number> = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    const d = new Date(new Date().getFullYear(), months[m[1]], +m[2], +m[3], +m[4]);
    if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
    return d;
  } catch { return null; }
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Weekly volume bar chart
function WeeklyChart({ days }: { days: { label: string; count: number; isToday: boolean }[] }) {
  const max = Math.max(...days.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-24 mt-4">
      {days.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-xs font-semibold text-[#1a1c1c]">{d.count > 0 ? d.count : ""}</span>
          <div className="w-full flex-1 flex items-end">
            <div
              className={`w-full rounded-t-lg transition-all duration-500 ${d.isToday ? "bg-purple-500" : "bg-purple-200"}`}
              style={{ minHeight: d.count > 0 ? "6px" : "2px", height: `${(d.count / max) * 64}px` }}
            />
          </div>
          <span className={`text-[10px] font-medium ${d.isToday ? "text-purple-600" : "text-[#48484a]"}`}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// Bar component for horizontal charts
function HBar({ label, value, max, color = "bg-purple-500", suffix = "" }: {
  label: string; value: number; max: number; color?: string; suffix?: string;
}) {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-[#1a1c1c]">{label}</span>
        <span className="text-xs font-semibold text-[#48484a]">{value}{suffix}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-low)" }}>
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

// Mini donut using SVG
function DonutChart({ slices }: { slices: { value: number; color: string; label: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;
  const r = 36;
  const cx = 44;
  const cy = 44;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0">
        {slices.map((slice, i) => {
          const fraction = slice.value / total;
          const strokeDasharray = `${fraction * circumference} ${circumference}`;
          const rotation = -90 + (cumulative / total) * 360;
          cumulative += slice.value;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={slice.color} strokeWidth="14"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={0}
              transform={`rotate(${rotation} ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
          );
        })}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          className="text-xs font-bold" fill="currentColor" fontSize="13" fontWeight="700">
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-[#48484a]">{s.label}</span>
            <span className="text-xs font-semibold text-[#1a1c1c] ml-auto pl-2">{pct(s.value, total)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { tickets, customers, slaPolicy } = useData();
  const reportRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    const total      = tickets.length;
    const open       = tickets.filter(t => t.status === "Open").length;
    const inProgress = tickets.filter(t => t.status === "In Progress").length;
    const resolved   = tickets.filter(t => t.status === "Resolved").length;
    const onHold     = tickets.filter(t => t.status === "On Hold").length;
    const active     = open + inProgress;
    const resRate    = pct(resolved, total);
    const escalated  = tickets.filter(t => t.escalated).length;

    // ── Last 7 days volume ──
    const today = new Date();
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const count = tickets.filter(t => {
        const td = parseCreatedToDate(t.created);
        return td ? isSameDay(td, d) : false;
      }).length;
      return { label: i === 6 ? "Today" : DAY_LABELS[d.getDay()], count, isToday: i === 6 };
    });
    const thisWeekCount = weekDays.reduce((s, d) => s + d.count, 0);

    // ── Issue type breakdown ──
    const issueTypes = ["Withdrawal Issue", "Restricted Withdrawals", "Deposits", "Blocked Accounts", "Bet Settlement", "Account Access", "Bonus Dispute", "Live Betting", "Other"];
    const issueCounts = issueTypes.map(i => ({ label: i, count: tickets.filter(t => t.issue === i).length }))
      .sort((a, b) => b.count - a.count);
    const maxIssue = Math.max(...issueCounts.map(x => x.count), 1);

    // ── Priority breakdown ──
    const prioritySlices = [
      { label: "High",   value: tickets.filter(t => t.priority === "High").length,   color: "#ef4444" },
      { label: "Medium", value: tickets.filter(t => t.priority === "Medium").length, color: "#f59e0b" },
      { label: "Low",    value: tickets.filter(t => t.priority === "Low").length,    color: "#22c55e" },
    ];

    // ── Status breakdown ──
    const statusSlices = [
      { label: "Open",        value: open,       color: "#7131d6" },
      { label: "In Progress", value: inProgress, color: "#0058bf" },
      { label: "Resolved",    value: resolved,   color: "#22c55e" },
      { label: "On Hold",     value: onHold,     color: "#f59e0b" },
    ].filter(s => s.value > 0);

    // ── Agent leaderboard ──
    const agentNames = Array.from(new Set(tickets.map(t => t.agent))).filter(a => a !== "Unassigned");
    const agentStats = agentNames.map(agent => {
      const agentTickets    = tickets.filter(t => t.agent === agent);
      const resolvedTickets = agentTickets.filter(t => t.status === "Resolved");
      const avgMs           = avgResolutionMs(resolvedTickets);
      return {
        name:     agent,
        total:    agentTickets.length,
        resolved: resolvedTickets.length,
        open:     agentTickets.filter(t => t.status === "Open" || t.status === "In Progress").length,
        avgMs,
      };
    }).sort((a, b) => b.total - a.total);
    const maxAgent = Math.max(...agentStats.map(a => a.total), 1);

    // ── Customer tier breakdown ──
    const tierColors: Record<string, string> = { VIP: "bg-purple-500", Premium: "bg-blue-500", Standard: "bg-slate-400" };
    const tierStats = (["VIP", "Premium", "Standard"] as const).map(tier => ({
      label: tier,
      customers: customers.filter(c => c.accountType === tier).length,
      tickets:   tickets.filter(t => {
        const c = customers.find(cu => cu.clientId === t.clientId);
        return c?.accountType === tier;
      }).length,
      color: tierColors[tier],
    }));
    const maxTierTickets = Math.max(...tierStats.map(t => t.tickets), 1);

    return {
      total, open, inProgress, resolved, onHold, active, resRate, escalated,
      weekDays, thisWeekCount,
      issueCounts, maxIssue,
      prioritySlices, statusSlices,
      agentStats, maxAgent,
      tierStats, maxTierTickets,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, customers]);

  const {
    total, open, inProgress, resolved, onHold, active, resRate, escalated,
    weekDays, thisWeekCount,
    issueCounts, maxIssue,
    prioritySlices, statusSlices,
    agentStats, maxAgent,
    tierStats, maxTierTickets,
  } = stats;

  function handleExport() {
    window.print();
  }

  return (
    <div className="max-w-[1400px] mx-auto" ref={reportRef}>
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-label-caps text-[#48484a] mb-1">Insights</p>
          <h1 className="text-display text-[#1a1c1c]">Analytics</h1>
          <p className="text-sm text-[#48484a] mt-1">Support performance at a glance</p>
        </div>
        <button onClick={handleExport}
          className="no-print flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#48484a] hover:bg-[#f3f3f3] transition-colors"
          style={{ background: "var(--surface-lowest)", border: "1px solid rgba(204,195,215,0.3)" }}>
          <Download size={14} /> Export PDF
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { icon: Ticket,        label: "TOTAL TICKETS",   value: total,          sub: "all time",           color: "text-purple-600",  bg: "bg-purple-50" },
          { icon: AlertCircle,   label: "ACTIVE",          value: active,         sub: "open + in progress", color: "text-amber-600",   bg: "bg-amber-50" },
          { icon: CheckCircle2,  label: "RESOLVED",        value: resolved,       sub: "tickets closed",     color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: TrendingUp,    label: "RESOLUTION RATE", value: `${resRate}%`,  sub: "resolved / total",   color: "text-blue-600",    bg: "bg-blue-50" },
          { icon: CalendarDays,  label: "THIS WEEK",       value: thisWeekCount,  sub: "last 7 days",        color: "text-violet-600",  bg: "bg-violet-50" },
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

      {/* Weekly volume + escalated */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
          <p className="text-label-caps text-[#48484a] mb-1">Trend</p>
          <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight">Ticket Volume — Last 7 Days</h3>
          <WeeklyChart days={weekDays} />
        </div>
        <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
          <p className="text-label-caps text-[#48484a] mb-1">Health</p>
          <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-5">SLA & Escalation</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
              <div>
                <p className="text-xs font-semibold text-[#48484a] uppercase tracking-wide">SLA Breached</p>
                <p className="text-xs text-[#48484a] mt-0.5">open tickets &gt; 30 min</p>
              </div>
              <span className="text-xl font-bold text-red-500">
                {tickets.filter(t => {
                  if (t.status === "Resolved" || t.status === "On Hold") return false;
                  const d = parseCreatedToDate(t.created);
                  if (!d) return false;
                  const elapsedMs = Date.now() - d.getTime();
                  const policy = slaPolicy[t.priority as keyof typeof slaPolicy];
                  const targetMs = (t.status === "Open" ? policy.firstReplyMinutes : policy.resolutionMinutes) * 60_000;
                  return elapsedMs > targetMs;
                }).length}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
              <div>
                <p className="text-xs font-semibold text-[#48484a] uppercase tracking-wide">Escalated</p>
                <p className="text-xs text-[#48484a] mt-0.5">auto + manual</p>
              </div>
              <span className="text-xl font-bold text-amber-500">{escalated}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
              <div>
                <p className="text-xs font-semibold text-[#48484a] uppercase tracking-wide">On Hold</p>
                <p className="text-xs text-[#48484a] mt-0.5">pending customer</p>
              </div>
              <span className="text-xl font-bold text-amber-600">{onHold}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle row: issue types + priority + status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">

        {/* Issue types — 3 cols */}
        <div className="lg:col-span-3 rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
          <p className="text-label-caps text-[#48484a] mb-1">Volume</p>
          <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-5">Tickets by Issue Type</h3>
          {issueCounts.map(({ label, count }, i) => (
            <HBar key={label} label={label} value={count} max={maxIssue}
              color={["bg-purple-500","bg-blue-500","bg-indigo-400","bg-violet-400","bg-purple-300"][i % 5]} />
          ))}
        </div>

        {/* Priority + Status donuts — 2 cols */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="rounded-2xl p-6 flex-1" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <p className="text-label-caps text-[#48484a] mb-1">Distribution</p>
            <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-4">By Priority</h3>
            <DonutChart slices={prioritySlices} />
          </div>
          <div className="rounded-2xl p-6 flex-1" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <p className="text-label-caps text-[#48484a] mb-1">Distribution</p>
            <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-4">By Status</h3>
            <DonutChart slices={statusSlices} />
          </div>
        </div>
      </div>

      {/* Bottom row: agent leaderboard + customer tiers */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Agent leaderboard — 3 cols */}
        <div className="lg:col-span-3 rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
          <div className="flex items-center gap-2 mb-5">
            <p className="text-label-caps text-[#48484a] flex-1">Performance</p>
          </div>
          <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight -mt-3 mb-5">Agent Leaderboard</h3>

          {/* Header */}
          <div className="grid grid-cols-[1.4fr_0.55fr_0.55fr_0.55fr_0.6fr_0.7fr_1fr] gap-2 px-3 mb-2">
            {["AGENT", "TOTAL", "ACTIVE", "DONE", "RATE", "AVG TIME", "WORKLOAD"].map(h => (
              <span key={h} className="text-label-caps text-[#48484a]">{h}</span>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {agentStats.map((agent, rank) => {
              const initials   = agent.name.split(" ").map((n: string) => n[0]).join("").toUpperCase();
              const barW       = Math.round((agent.total / maxAgent) * 100);
              const rate       = agent.total > 0 ? Math.round((agent.resolved / agent.total) * 100) : 0;
              const rateColor  = rate >= 70 ? "text-emerald-600" : rate >= 40 ? "text-amber-600" : "text-red-500";
              const avgTimeStr = agent.avgMs != null ? formatDuration(agent.avgMs) : "—";
              return (
                <div key={agent.name}
                  className="grid grid-cols-[1.4fr_0.55fr_0.55fr_0.55fr_0.6fr_0.7fr_1fr] gap-2 items-center px-3 py-2.5 rounded-xl"
                  style={{ background: "var(--surface-low)" }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-[#48484a] w-4 flex-shrink-0">#{rank + 1}</span>
                    <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                      {initials}
                    </div>
                    <span className="text-sm font-medium text-[#1a1c1c] truncate">{agent.name}</span>
                  </div>
                  <span className="text-sm font-bold text-[#1a1c1c]">{agent.total}</span>
                  <span className="text-sm text-amber-600 font-medium">{agent.open}</span>
                  <span className="text-sm text-emerald-600 font-medium">{agent.resolved}</span>
                  <span className={`text-sm font-semibold ${rateColor}`}>{rate}%</span>
                  <span className="text-sm text-[#48484a] font-medium">{avgTimeStr}</span>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-lowest)" }}>
                    <div className="h-1.5 rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${barW}%` }} />
                  </div>
                </div>
              );
            })}
            {agentStats.length === 0 && (
              <p className="text-sm text-[#48484a] text-center py-8">No agent data yet.</p>
            )}
          </div>
        </div>

        {/* Customer tier — 2 cols */}
        <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
          <p className="text-label-caps text-[#48484a] mb-1">Segments</p>
          <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-5">Customer Tiers</h3>

          <div className="flex flex-col gap-5">
            {tierStats.map(({ label, customers: cCount, tickets: tCount, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-sm font-medium text-[#1a1c1c]">{label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#48484a]">
                    <span className="flex items-center gap-1"><Users size={11} /> {cCount}</span>
                    <span className="flex items-center gap-1"><Ticket size={11} /> {tCount}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-low)" }}>
                  <div className={`h-2 rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${pct(tCount, maxTierTickets)}%` }} />
                </div>
                <p className="text-xs text-[#48484a] mt-1">
                  {pct(tCount, total)}% of all tickets · avg {cCount > 0 ? (tCount / cCount).toFixed(1) : 0} per customer
                </p>
              </div>
            ))}
          </div>

          {/* Totals summary */}
          <div className="mt-6 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: "1px solid rgba(204,195,215,0.15)" }}>
            <div className="rounded-xl p-3 text-center" style={{ background: "var(--surface-low)" }}>
              <p className="text-label-caps text-[#48484a] mb-1">CUSTOMERS</p>
              <p className="text-xl font-bold text-[#1a1c1c]">{customers.length}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "var(--surface-low)" }}>
              <p className="text-label-caps text-[#48484a] mb-1">TICKETS/CLIENT</p>
              <p className="text-xl font-bold text-[#1a1c1c]">
                {customers.length > 0 ? (total / customers.length).toFixed(1) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
