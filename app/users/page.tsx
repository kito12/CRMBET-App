"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search, Users, Clock, Plus, X, Mail, Shield, UserCircle, Trash2,
  ChevronDown, TrendingUp, CheckCircle2, Target, AlertCircle,
  Calendar, Hash, ExternalLink, AlertTriangle,
} from "lucide-react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import Link from "next/link";
import { StatusPill, PriorityPill } from "@/components/ui/StatusPill";

type FirestoreUser = {
  uid:       string;
  email:     string;
  name:      string;
  role:      "admin" | "agent";
  photo?:    string | null;
  active:    boolean;
  createdAt: string;
};

type Invite = {
  id:        string;
  email:     string;
  createdAt: string;
};

const roleColor: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700",
  agent: "bg-blue-50 text-blue-700",
};

const gradientPool = [
  "from-purple-500 to-violet-600", "from-blue-500 to-indigo-600",
  "from-rose-500 to-pink-600",     "from-teal-500 to-cyan-600",
  "from-amber-500 to-orange-500",  "from-emerald-500 to-teal-600",
  "from-indigo-400 to-purple-500", "from-violet-500 to-purple-700",
];

function getGradient(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return gradientPool[Math.abs(hash) % gradientPool.length];
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60)  return `${mins}m`;
  const hrs = mins / 60;
  if (hrs < 24)   return `${hrs.toFixed(1)}h`;
  return `${(hrs / 24).toFixed(1)}d`;
}

function formatJoined(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "Unknown"; }
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { tickets } = useData();
  const isAdmin = currentUser?.role === "admin";

  const [users,        setUsers]        = useState<FirestoreUser[]>([]);
  const [invites,      setInvites]      = useState<Invite[]>([]);
  const [search,       setSearch]       = useState("");
  const [inviteOpen,   setInviteOpen]   = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [inviteEmail,  setInviteEmail]  = useState("");
  const [inviteError,  setInviteError]  = useState("");
  const [inviting,     setInviting]     = useState(false);
  const [perfView,     setPerfView]     = useState(false);

  // Agent profile modal
  const [selectedAgent,  setSelectedAgent]  = useState<FirestoreUser | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  // Weekly targets — admin-configurable, stored in localStorage
  const [targets, setTargets] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("agentTargets") ?? "{}"); } catch { return {}; }
  });
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [targetInput,   setTargetInput]   = useState("");

  // Live users from Firestore
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as FirestoreUser)));
    });
  }, []);

  // Live invites from Firestore
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "invites"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invite)));
    });
  }, [isAdmin]);

  // Auto-clean stale invites: if an invite email already has a user account, delete it
  useEffect(() => {
    if (!isAdmin || invites.length === 0 || users.length === 0) return;
    const userEmails = new Set(users.map(u => u.email.toLowerCase()));
    const stale = invites.filter(i => userEmails.has(i.email.toLowerCase()));
    if (stale.length === 0) return;
    Promise.all(stale.map(i => deleteDoc(doc(db, "invites", i.id)))).catch(console.error);
  }, [users, invites, isAdmin]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(email)) { setInviteError("Enter a valid email address."); return; }
    if (users.some(u => u.email.toLowerCase() === email)) { setInviteError("This person already has an account."); return; }
    if (invites.some(i => i.email === email)) { setInviteError("An invite for this email already exists."); return; }

    setInviting(true);
    try {
      await addDoc(collection(db, "invites"), {
        email,
        invitedBy: currentUser?.email ?? "admin",
        createdAt: new Date().toISOString(),
      });
      setInviteEmail("");
      setInviteError("");
      setInviteOpen(false);
    } catch {
      setInviteError("Failed to send invite. Try again.");
    } finally {
      setInviting(false);
    }
  }

  async function removeInvite(id: string) {
    await deleteDoc(doc(db, "invites", id));
  }

  async function changeRole(uid: string, newRole: "admin" | "agent") {
    setRoleUpdating(uid);
    try {
      await updateDoc(doc(db, "users", uid), { role: newRole });
      // Sync selectedAgent role immediately if modal is open
      if (selectedAgent?.uid === uid) setSelectedAgent(a => a ? { ...a, role: newRole } : a);
    } finally {
      setRoleUpdating(null);
    }
  }

  async function handleDeleteUser() {
    if (!selectedAgent) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", selectedAgent.uid));
      setSelectedAgent(null);
      setDeleteConfirm(false);
    } catch (err) {
      console.error("Failed to delete user:", err);
    } finally {
      setDeleting(false);
    }
  }

  function saveTarget(name: string, val: string) {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) {
      const next = { ...targets, [name]: n };
      setTargets(next);
      try { localStorage.setItem("agentTargets", JSON.stringify(next)); } catch { /* ignore */ }
    }
    setEditingTarget(null);
  }

  // Performance stats per agent — computed from live tickets
  const agentPerf = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return users.map(agent => {
      const mine     = tickets.filter(t => t.agent === agent.name);
      const resolved = mine.filter(t => t.status === "Resolved");

      const resolvedThisWeek = resolved.filter(t => {
        const d = t.resolvedAt ? new Date(t.resolvedAt) : null;
        return d && d >= startOfWeek;
      }).length;

      const open = mine.filter(t => t.status === "Open" || t.status === "In Progress").length;

      const times = resolved
        .filter(t => t.resolvedAt && t.createdAt)
        .map(t => new Date(t.resolvedAt!).getTime() - new Date(t.createdAt!).getTime())
        .filter(ms => ms > 0);
      const avgMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;

      const slaResolved = resolved.filter(t => {
        if (!t.resolvedAt || !t.createdAt) return false;
        const elapsed = new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        return elapsed <= 24 * 60 * 60 * 1000;
      }).length;
      const slaRate = resolved.length ? Math.round((slaResolved / resolved.length) * 100) : null;

      const target   = targets[agent.name] ?? 20;
      const progress = Math.min(100, Math.round((resolvedThisWeek / target) * 100));

      const recentTickets = mine
        .sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        })
        .slice(0, 5);

      return { uid: agent.uid, name: agent.name, photo: agent.photo, email: agent.email,
               resolvedThisWeek, open, avgMs, slaRate, target, progress,
               totalResolved: resolved.length, recentTickets };
    });
  }, [users, tickets, targets]);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === "admin").length;

  // Find perf data for selected agent
  const selectedPerf = selectedAgent ? agentPerf.find(ap => ap.uid === selectedAgent.uid) : null;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-label-caps text-[#48484a] mb-1">People</p>
          <h1 className="text-display text-[#1a1c1c]">Support Team</h1>
          <p className="text-sm text-[#48484a] mt-1">Manage agents and access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPerfView(v => !v)}
            className={`text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
              perfView
                ? "gradient-primary text-white shadow-ambient"
                : "border text-[#48484a] hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
            }`}
            style={perfView ? {} : { background: "var(--surface-lowest)", borderColor: "rgba(204,195,215,0.5)" }}>
            <TrendingUp size={15} /> Performance
          </button>
          {isAdmin && (
            <button onClick={() => setInviteOpen(true)}
              className="gradient-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity shadow-ambient">
              <Plus size={15} /> Add Agent
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Users,  label: "TOTAL AGENTS",    value: users.length,    sub: "registered accounts", color: "text-purple-600", bg: "bg-purple-50" },
          { icon: Shield, label: "ADMINS",           value: adminCount,      sub: "full access",         color: "text-blue-600",   bg: "bg-blue-50"   },
          { icon: Clock,  label: "PENDING INVITES",  value: invites.length,  sub: "awaiting sign-in",    color: "text-amber-600",  bg: "bg-amber-50"  },
        ].map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}><Icon size={16} className={color} /></div>
            <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
            <p className="text-2xl font-bold text-[#1a1c1c] tracking-tight">{value}</p>
            <p className="text-xs text-[#48484a] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#48484a]" />
        <input type="text" placeholder="Search agents..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-200 transition-all"
          style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} />
      </div>

      {/* Active users grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8 items-stretch">
        {filtered.map(agent => {
          const perf = agentPerf.find(ap => ap.uid === agent.uid);
          const openCount = perf?.open ?? 0;
          const isSelf = agent.uid === currentUser?.uid;
          return (
            <div key={agent.uid}
              onClick={() => { setSelectedAgent(agent); setDeleteConfirm(false); }}
              className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group relative flex flex-col"
              style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 16px 60px 0 rgba(26,28,28,0.10)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 8px 40px 0 rgba(26,28,28,0.06)")}>

              {/* Admin delete button — top-right, only visible on hover */}
              {isAdmin && !isSelf && (
                <button
                  onClick={e => { e.stopPropagation(); setSelectedAgent(agent); setDeleteConfirm(true); }}
                  title="Remove agent"
                  className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 size={13} />
                </button>
              )}

              {/* Avatar */}
              <div className="relative w-12 h-12 mb-4 flex-shrink-0">
                {agent.photo ? (
                  <img src={agent.photo} alt={agent.name} className="w-12 h-12 rounded-2xl object-cover" />
                ) : (
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getGradient(agent.email)} flex items-center justify-center text-white text-sm font-semibold`}>
                    {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 bg-emerald-400"
                  style={{ borderColor: "var(--surface-lowest)" }} />
              </div>

              {/* Name */}
              <h3 className="text-sm font-semibold tracking-tight mb-1 truncate pr-2" style={{ color: "var(--on-surface)" }}>{agent.name}</h3>

              {/* Role — always a consistent badge; change role is in the profile modal */}
              <span className={`inline-flex items-center self-start px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${roleColor[agent.role]}`}>
                {agent.role === "admin" ? "Administrator" : "Support Agent"}
              </span>

              {/* Email */}
              <p className="text-xs truncate mb-3" style={{ color: "var(--on-surface-variant)" }}>{agent.email}</p>

              {/* Spacer — pushes ticket count to bottom */}
              <div className="flex-1" />

              {/* Bottom row — always rendered, keeps all cards the same height */}
              <div className="flex items-center justify-between pt-3 mt-1"
                style={{ borderTop: "1px solid rgba(148,163,184,0.12)" }}>
                <span className={`text-xs font-medium ${openCount > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                  {openCount} open {openCount === 1 ? "ticket" : "tickets"}
                </span>
                {isSelf && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600">You</span>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-4 py-16 text-center text-sm" style={{ color: "var(--on-surface-variant)" }}>
            No agents found.
          </div>
        )}
      </div>

      {/* ── Performance View ─────────────────────────────────────────────────── */}
      {perfView && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-purple-600" />
              <h2 className="text-base font-semibold" style={{ color: "var(--on-surface)" }}>Agent Performance</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">This week</span>
            </div>
            {isAdmin && <p className="text-xs" style={{ color: "var(--on-surface-variant)" }}>Click a target to edit</p>}
          </div>

          <div className="flex flex-col gap-3">
            {agentPerf.map(ap => {
              const isEditingThis = editingTarget === ap.uid;
              const progressColor =
                ap.progress >= 100 ? "bg-emerald-500" :
                ap.progress >= 60  ? "bg-purple-500"  :
                ap.progress >= 30  ? "bg-amber-500"   : "bg-red-400";

              return (
                <div key={ap.uid}
                  className="rounded-2xl px-6 py-4 transition-all"
                  style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
                  <div className="flex items-center gap-4">
                    <div className="shrink-0">
                      {ap.photo ? (
                        <img src={ap.photo} alt={ap.name} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradient(ap.email)} flex items-center justify-center text-white text-xs font-semibold`}>
                          {ap.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="w-36 shrink-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--on-surface)" }}>{ap.name}</p>
                      <p className="text-xs truncate" style={{ color: "var(--on-surface-variant)" }}>{ap.email}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: "var(--on-surface-variant)" }}>Weekly target</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold" style={{ color: "var(--on-surface)" }}>{ap.resolvedThisWeek}</span>
                          <span className="text-xs" style={{ color: "var(--on-surface-variant)" }}>/</span>
                          {isAdmin ? (
                            isEditingThis ? (
                              <input autoFocus type="number" min={1} value={targetInput}
                                onChange={e => setTargetInput(e.target.value)}
                                onBlur={() => saveTarget(ap.name, targetInput)}
                                onKeyDown={e => { if (e.key === "Enter") saveTarget(ap.name, targetInput); if (e.key === "Escape") setEditingTarget(null); }}
                                className="w-12 text-center text-xs font-semibold rounded-md px-1 py-0.5 outline-none focus:ring-2 focus:ring-purple-300"
                                style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} />
                            ) : (
                              <button onClick={() => { setEditingTarget(ap.uid); setTargetInput(String(ap.target)); }}
                                className="text-xs font-semibold text-purple-600 hover:text-purple-800 hover:underline transition-colors flex items-center gap-0.5"
                                title="Click to edit target">
                                {ap.target}<Target size={9} className="opacity-60" />
                              </button>
                            )
                          ) : (
                            <span className="text-xs font-semibold" style={{ color: "var(--on-surface)" }}>{ap.target}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ background: "var(--surface-low)" }}>
                        <div className={`h-2 rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${ap.progress}%` }} />
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--on-surface-variant)" }}>{ap.progress}% of weekly target</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      <div className="text-center min-w-[52px]">
                        <p className={`text-base font-bold ${ap.open > 0 ? "text-amber-500" : "text-emerald-500"}`}>{ap.open}</p>
                        <p className="text-[10px]" style={{ color: "var(--on-surface-variant)" }}>Open</p>
                      </div>
                      <div className="text-center min-w-[52px]">
                        <p className="text-base font-bold text-purple-600">{ap.totalResolved}</p>
                        <p className="text-[10px]" style={{ color: "var(--on-surface-variant)" }}>All-time</p>
                      </div>
                      <div className="text-center min-w-[52px]">
                        <p className="text-base font-bold" style={{ color: "var(--on-surface)" }}>
                          {ap.avgMs !== null ? formatDuration(ap.avgMs) : "--"}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--on-surface-variant)" }}>Avg time</p>
                      </div>
                      <div className="text-center min-w-[52px]">
                        {ap.slaRate !== null ? (
                          <div className="flex flex-col items-center">
                            <p className={`text-base font-bold ${ap.slaRate >= 80 ? "text-emerald-500" : ap.slaRate >= 60 ? "text-amber-500" : "text-red-500"}`}>{ap.slaRate}%</p>
                            <p className="text-[10px]" style={{ color: "var(--on-surface-variant)" }}>SLA</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <p className="text-base font-bold text-[#9ca3af]">--</p>
                            <p className="text-[10px]" style={{ color: "var(--on-surface-variant)" }}>SLA</p>
                          </div>
                        )}
                      </div>
                      <div className="w-8 flex items-center justify-center">
                        {ap.progress >= 100 && <span title="Weekly target achieved!"><CheckCircle2 size={18} className="text-emerald-500" /></span>}
                        {ap.open >= 10 && ap.progress < 30 && <span title="High open count, low progress"><AlertCircle size={18} className="text-red-400" /></span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {agentPerf.length === 0 && (
              <div className="py-12 text-center text-sm rounded-2xl" style={{ background: "var(--surface-lowest)", color: "var(--on-surface-variant)" }}>
                No agents to display.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending invites — admin only */}
      {isAdmin && invites.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Mail size={16} className="text-amber-500" />
            <h2 className="text-base font-semibold" style={{ color: "var(--on-surface)" }}>Pending Invites</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">{invites.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                    <UserCircle size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>{invite.email}</p>
                    <p className="text-xs" style={{ color: "var(--on-surface-variant)" }}>Invited · awaiting sign-in</p>
                  </div>
                </div>
                <button onClick={() => removeInvite(invite.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setInviteOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl p-7 relative"
              style={{ background: "var(--surface-lowest)", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
              <button onClick={() => setInviteOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                style={{ color: "var(--on-surface-variant)", background: "var(--surface-low)" }}>
                <X size={15} />
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                  <Plus size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--on-surface)" }}>Invite Agent</h2>
                  <p className="text-xs" style={{ color: "var(--on-surface-variant)" }}>They'll sign in with their Google account</p>
                </div>
              </div>
              <form onSubmit={sendInvite} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-surface-variant)" }}>Gmail address</label>
                  <input type="email" placeholder="agent@gmail.com" value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError(""); }}
                    autoFocus required
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-300 transition-all"
                    style={{ background: "var(--surface-low)", color: "var(--on-surface)" }} />
                  {inviteError && <p className="text-xs text-red-500 mt-1.5">{inviteError}</p>}
                </div>
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(113,49,214,0.07)", color: "var(--on-surface-variant)" }}>
                  Once invited, the agent visits the app and signs in with this Google account. They'll automatically get access.
                </p>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setInviteOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                    style={{ background: "var(--surface-low)", color: "var(--on-surface-variant)" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={inviting || !inviteEmail.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50">
                    {inviting ? "Inviting…" : "Send Invite"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* ── Agent Profile Modal ─────────────────────────────────────────────── */}
      {selectedAgent && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={() => { setSelectedAgent(null); setDeleteConfirm(false); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
              style={{ background: "var(--surface-lowest)", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", maxHeight: "90vh" }}>

              {/* ── Header band ── */}
              <div className="px-7 py-6 flex-shrink-0" style={{ background: "var(--surface-low)" }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      {selectedAgent.photo ? (
                        <img src={selectedAgent.photo} alt={selectedAgent.name} className="w-16 h-16 rounded-2xl object-cover" />
                      ) : (
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getGradient(selectedAgent.email)} flex items-center justify-center text-white text-xl font-bold`}>
                          {selectedAgent.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 bg-emerald-400"
                        style={{ borderColor: "var(--surface-low)" }} />
                    </div>

                    {/* Name + meta */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold tracking-tight" style={{ color: "var(--on-surface)" }}>
                          {selectedAgent.name}
                        </h2>
                        {selectedAgent.uid === currentUser?.uid && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">You</span>
                        )}
                      </div>
                      <p className="text-sm mt-0.5" style={{ color: "var(--on-surface-variant)" }}>{selectedAgent.email}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleColor[selectedAgent.role]}`}>
                          {selectedAgent.role === "admin" ? "Administrator" : "Support Agent"}
                        </span>
                        {selectedAgent.createdAt && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--on-surface-variant)" }}>
                            <Calendar size={11} />
                            Joined {formatJoined(selectedAgent.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button onClick={() => { setSelectedAgent(null); setDeleteConfirm(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
                    style={{ color: "var(--on-surface-variant)", background: "var(--surface-lowest)" }}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="overflow-y-auto flex-1 p-7 flex flex-col gap-6">

                {/* Performance stats */}
                {selectedPerf && (
                  <div>
                    <p className="text-label-caps text-[#48484a] mb-3">Performance</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Open",      value: selectedPerf.open,                       color: selectedPerf.open > 0 ? "text-amber-500" : "text-emerald-500" },
                        { label: "All-time",  value: selectedPerf.totalResolved,              color: "text-purple-600" },
                        { label: "Avg time",  value: selectedPerf.avgMs !== null ? formatDuration(selectedPerf.avgMs) : "—", color: "var(--on-surface)" },
                        { label: "SLA rate",  value: selectedPerf.slaRate !== null ? `${selectedPerf.slaRate}%` : "—",
                          color: selectedPerf.slaRate === null ? "var(--on-surface-variant)" : selectedPerf.slaRate >= 80 ? "text-emerald-500" : selectedPerf.slaRate >= 60 ? "text-amber-500" : "text-red-500" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-xl px-4 py-3 text-center" style={{ background: "var(--surface-low)" }}>
                          <p className={`text-xl font-bold ${color}`} style={typeof color === "string" && color.startsWith("var") ? { color } : {}}>{value}</p>
                          <p className="text-[10px] font-medium mt-0.5" style={{ color: "var(--on-surface-variant)" }}>{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Weekly progress bar */}
                    <div className="mt-3 rounded-xl px-4 py-3" style={{ background: "var(--surface-low)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: "var(--on-surface-variant)" }}>This week</span>
                        <span className="text-xs font-bold" style={{ color: "var(--on-surface)" }}>
                          {selectedPerf.resolvedThisWeek} / {selectedPerf.target} resolved
                        </span>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ background: "var(--surface-lowest)" }}>
                        <div className={`h-2 rounded-full transition-all duration-500 ${
                          selectedPerf.progress >= 100 ? "bg-emerald-500" :
                          selectedPerf.progress >= 60  ? "bg-purple-500"  :
                          selectedPerf.progress >= 30  ? "bg-amber-500"   : "bg-red-400"
                        }`} style={{ width: `${selectedPerf.progress}%` }} />
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: "var(--on-surface-variant)" }}>
                        {selectedPerf.progress}% of weekly target
                        {selectedPerf.progress >= 100 && " · ✓ Target achieved"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Recent tickets */}
                {selectedPerf && selectedPerf.recentTickets.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-label-caps text-[#48484a]">Recent tickets</p>
                      <Link href={`/tickets?agentFilter=${encodeURIComponent(selectedAgent.name)}`}
                        onClick={() => setSelectedAgent(null)}
                        className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors">
                        View all <ExternalLink size={10} />
                      </Link>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {selectedPerf.recentTickets.map(t => (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: "var(--surface-low)" }}>
                          {/* Left: ID stacked above issue — avoids overflow into text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-purple-600 truncate">{t.id}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: "var(--on-surface)" }}>{t.issue}</p>
                          </div>
                          {/* Right: pills always shrink to fit */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <StatusPill status={t.status} />
                            <PriorityPill priority={t.priority} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin actions */}
                {isAdmin && selectedAgent.uid !== currentUser?.uid && (
                  <div>
                    <p className="text-label-caps text-[#48484a] mb-3">Admin actions</p>

                    {/* Role change */}
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-2"
                      style={{ background: "var(--surface-low)" }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>Role</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--on-surface-variant)" }}>
                          {selectedAgent.role === "admin" ? "Has full admin access" : "Standard support access"}
                        </p>
                      </div>
                      <div className="relative">
                        <select
                          value={selectedAgent.role}
                          disabled={roleUpdating === selectedAgent.uid}
                          onChange={e => changeRole(selectedAgent.uid, e.target.value as "admin" | "agent")}
                          className={`appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-semibold cursor-pointer outline-none transition-opacity border ${roleColor[selectedAgent.role]} ${roleUpdating === selectedAgent.uid ? "opacity-50" : ""}`}
                          style={{ borderColor: "rgba(148,163,184,0.2)" }}>
                          <option value="agent">Support Agent</option>
                          <option value="admin">Administrator</option>
                        </select>
                        <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                      </div>
                    </div>

                    {/* Delete */}
                    {!deleteConfirm ? (
                      <button onClick={() => setDeleteConfirm(true)}
                        className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
                        style={{ background: "var(--surface-low)" }}>
                        <Trash2 size={14} />
                        Remove {selectedAgent.name} from team
                      </button>
                    ) : (
                      <div className="rounded-xl px-4 py-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <div className="flex items-start gap-2.5 mb-4">
                          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-red-600">Remove {selectedAgent.name}?</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--on-surface-variant)" }}>
                              This removes their access immediately. Their tickets will remain assigned to them.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteConfirm(false)}
                            className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors"
                            style={{ background: "var(--surface-low)", color: "var(--on-surface-variant)" }}>
                            Cancel
                          </button>
                          <button onClick={handleDeleteUser} disabled={deleting}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60">
                            {deleting ? "Removing…" : "Yes, Remove"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
