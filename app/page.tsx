"use client";

import { StatusPill } from "@/components/ui/StatusPill";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  ArrowRight,
  Dot,
} from "lucide-react";
import Link from "next/link";

const recentTickets = [
  { id: "TKT-1042", customer: "Marcus Webb", issue: "Withdrawal Issue", status: "Open" as const, agent: "Sarah K.", time: "4m ago" },
  { id: "TKT-1041", customer: "Priya Nair", issue: "Bet Settlement", status: "In Progress" as const, agent: "James R.", time: "12m ago" },
  { id: "TKT-1040", customer: "Leo Fernandez", issue: "Account Access", status: "Open" as const, agent: "Unassigned", time: "28m ago" },
  { id: "TKT-1039", customer: "Amber Chen", issue: "Bonus Dispute", status: "In Progress" as const, agent: "Tom H.", time: "1h ago" },
  { id: "TKT-1038", customer: "David Osei", issue: "Live Betting", status: "Resolved" as const, agent: "Sarah K.", time: "2h ago" },
  { id: "TKT-1037", customer: "Nina Patel", issue: "Withdrawal Issue", status: "Resolved" as const, agent: "James R.", time: "3h ago" },
];

const activityFeed = [
  { text: "TKT-1041 escalated to Tier 2", time: "2m ago", dot: "bg-amber-400" },
  { text: "Sarah K. resolved TKT-1038", time: "2h ago", dot: "bg-emerald-400" },
  { text: "New high-priority ticket from Leo F.", time: "28m ago", dot: "bg-red-400" },
  { text: "Avg response dipped below SLA", time: "1h ago", dot: "bg-purple-400" },
  { text: "James R. came online", time: "3h ago", dot: "bg-blue-400" },
];

export default function Dashboard() {
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-label-caps text-[#48484a] mb-1">Overview</p>
        <h1 className="text-display text-[#1a1c1c]">Dashboard</h1>
      </div>

      {/* 60/40 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* LEFT — 60% (3 cols) */}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: AlertCircle, label: "OPEN TICKETS", value: "47", sub: "+3 since yesterday", color: "text-purple-600", bg: "bg-purple-50" },
                { icon: CheckCircle2, label: "RESOLVED TODAY", value: "23", sub: "↑ 12% vs avg", color: "text-emerald-600", bg: "bg-emerald-50" },
                { icon: Clock, label: "AVG RESPONSE", value: "8m", sub: "SLA target: 10m", color: "text-blue-600", bg: "bg-blue-50" },
              ].map(({ icon: Icon, label, value, sub, color, bg }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: "var(--surface-low)" }}>
                  <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
                    <Icon size={16} className={color} />
                  </div>
                  <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
                  <p className="text-2xl font-700 text-[#1a1c1c] font-bold tracking-tight">{value}</p>
                  <p className="text-xs text-[#48484a] mt-1">{sub}</p>
                </div>
              ))}
            </div>
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
                {["TICKET", "CUSTOMER", "ISSUE", "STATUS", "AGENT"].map((h) => (
                  <span key={h} className="text-label-caps text-[#48484a]">{h}</span>
                ))}
              </div>
              {recentTickets.map((ticket) => (
                <div key={ticket.id}
                  className="grid grid-cols-[1fr_1.4fr_1.4fr_1fr_0.7fr] gap-3 items-center px-3 py-3 rounded-xl transition-all duration-150 hover:cursor-pointer"
                  style={{ background: "var(--surface-low)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-lowest)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-low)")}
                >
                  <span className="text-sm font-medium text-purple-600">{ticket.id}</span>
                  <span className="text-sm text-[#1a1c1c]">{ticket.customer}</span>
                  <span className="text-sm text-[#48484a]">{ticket.issue}</span>
                  <StatusPill status={ticket.status} />
                  <span className="text-xs text-[#48484a]">{ticket.agent}</span>
                </div>
              ))}
            </div>
            {/* Mobile cards */}
            <div className="flex sm:hidden flex-col gap-2">
              {recentTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between px-3 py-3 rounded-xl"
                  style={{ background: "var(--surface-low)" }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-purple-600">{ticket.id}</span>
                      <StatusPill status={ticket.status} />
                    </div>
                    <p className="text-sm text-[#1a1c1c] truncate">{ticket.customer}</p>
                    <p className="text-xs text-[#48484a]">{ticket.issue} · {ticket.agent}</p>
                  </div>
                  <span className="text-xs text-[#48484a] flex-shrink-0 ml-2">{ticket.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — 40% (2 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, label: "ACTIVE AGENTS", value: "12", sub: "of 18 online", color: "text-purple-600", bg: "bg-purple-50" },
              { icon: TrendingUp, label: "CSAT SCORE", value: "94%", sub: "↑ 2pts this week", color: "text-blue-600", bg: "bg-blue-50" },
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

          {/* Issue breakdown */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <p className="text-label-caps text-[#48484a] mb-1">Breakdown</p>
            <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-5">By Issue Type</h3>
            {[
              { label: "Withdrawal", pct: 38, color: "bg-purple-500" },
              { label: "Bet Settlement", pct: 27, color: "bg-blue-500" },
              { label: "Account Access", pct: 18, color: "bg-indigo-400" },
              { label: "Bonus Dispute", pct: 11, color: "bg-violet-300" },
              { label: "Live Betting", pct: 6, color: "bg-purple-200" },
            ].map(({ label, pct, color }) => (
              <div key={label} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-[#1a1c1c]">{label}</span>
                  <span className="text-xs text-[#48484a]">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--surface-low)" }}>
                  <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <p className="text-label-caps text-[#48484a] mb-1">Live</p>
            <h3 className="text-base font-semibold text-[#1a1c1c] tracking-tight mb-4">Activity Feed</h3>
            <div className="flex flex-col gap-3">
              {activityFeed.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
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
    </div>
  );
}
