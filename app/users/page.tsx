"use client";

import { useState, useEffect } from "react";
import { Search, Users, Clock, Star, Plus, X, Mail, Shield, UserCircle, Trash2 } from "lucide-react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

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

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [users,       setUsers]       = useState<FirestoreUser[]>([]);
  const [invites,     setInvites]     = useState<Invite[]>([]);
  const [search,      setSearch]      = useState("");
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting,    setInviting]    = useState(false);

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

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === "admin").length;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-label-caps text-[#48484a] mb-1">People</p>
          <h1 className="text-display text-[#1a1c1c]">Support Team</h1>
          <p className="text-sm text-[#48484a] mt-1">Manage agents and access</p>
        </div>
        {isAdmin && (
          <button onClick={() => setInviteOpen(true)}
            className="gradient-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity shadow-ambient">
            <Plus size={15} /> Add Agent
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Users,       label: "TOTAL AGENTS",   value: users.length,                    sub: "registered accounts",    color: "text-purple-600", bg: "bg-purple-50" },
          { icon: Shield,      label: "ADMINS",         value: adminCount,                       sub: "full access",            color: "text-blue-600",   bg: "bg-blue-50"   },
          { icon: Clock,       label: "PENDING INVITES",value: invites.length,                   sub: "awaiting sign-in",       color: "text-amber-600",  bg: "bg-amber-50"  },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        {filtered.map(agent => (
          <div key={agent.uid}
            className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 16px 60px 0 rgba(26,28,28,0.10)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 8px 40px 0 rgba(26,28,28,0.06)")}>

            <div className="relative w-12 h-12 mb-4">
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

            <h3 className="text-sm font-semibold tracking-tight mb-1" style={{ color: "var(--on-surface)" }}>{agent.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${roleColor[agent.role]}`}>
              {agent.role === "admin" ? "Administrator" : "Support Agent"}
            </span>

            <p className="text-xs truncate" style={{ color: "var(--on-surface-variant)" }}>{agent.email}</p>

            {/* Show "You" badge for current user */}
            {agent.uid === currentUser?.uid && (
              <span className="mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600">You</span>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-4 py-16 text-center text-sm" style={{ color: "var(--on-surface-variant)" }}>
            No agents found.
          </div>
        )}
      </div>

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
              <div key={invite.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "var(--surface-low)" }}>
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
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--on-surface-variant)" }}>
                    Gmail address
                  </label>
                  <input
                    type="email"
                    placeholder="agent@gmail.com"
                    value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError(""); }}
                    autoFocus
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-300 transition-all"
                    style={{ background: "var(--surface-low)", color: "var(--on-surface)" }}
                  />
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
    </div>
  );
}
