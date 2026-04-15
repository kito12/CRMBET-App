"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { MessageSquare, Send, Hash, AtSign, Search, ArrowLeft } from "lucide-react";
import type { Ticket } from "@/lib/data";
import { StatusPill, PriorityPill } from "@/components/ui/StatusPill";
import { useData } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import {
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, increment as fsIncrement,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  photo?: string | null;
  online?: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  createdAt: string;
}

interface ConvMeta {
  participants: string[];
  lastMessage?: string;
  lastSenderId?: string;
  updatedAt?: string;
  unread?: Record<string, number>;
}

type Part =
  | { type: "text"; content: string }
  | { type: "ticket"; ticketId: string }
  | { type: "agent"; agentName: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const colorPool = ["#7131d6","#0058bf","#059669","#db2777","#d97706","#dc2626","#0891b2","#7c3aed"];

function getMemberColor(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return colorPool[Math.abs(h) % colorPool.length];
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function convDocId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join("__");
}

function nowTime(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function parseParts(text: string, memberNames: string[]): Part[] {
  if (!text) return [{ type: "text", content: "" }];
  const escaped = memberNames
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pattern = escaped ? `(#TKT-\\d+|@(?:${escaped}))` : "(#TKT-\\d+)";
  const regex = new RegExp(pattern, "g");
  return text.split(regex).filter(s => s.length > 0).map(s => {
    if (s.startsWith("#TKT-")) return { type: "ticket" as const, ticketId: s.slice(1) };
    if (s.startsWith("@"))     return { type: "agent"  as const, agentName: s.slice(1) };
    return                            { type: "text"   as const, content: s };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TicketCard({ ticketId }: { ticketId: string }) {
  const { tickets } = useData();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return <span className="font-semibold text-purple-400">#{ticketId}</span>;
  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs align-middle mx-0.5 flex-wrap"
      style={{ background: "rgba(113,49,214,0.08)", border: "1px solid rgba(113,49,214,0.18)" }}>
      <span className="font-semibold text-purple-500">{ticket.id}</span>
      <span className="text-[#48484a]">{ticket.issue}</span>
      <PriorityPill priority={ticket.priority} />
      <StatusPill status={ticket.status} />
    </span>
  );
}

function AgentMention({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-purple-600 font-medium text-sm mx-0.5"
      style={{ background: "rgba(113,49,214,0.1)" }}>
      @{name}
    </span>
  );
}

function RenderParts({ parts, isMe }: { parts: Part[]; isMe: boolean }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "ticket") return <TicketCard key={i} ticketId={p.ticketId} />;
        if (p.type === "agent")  return <AgentMention key={i} name={p.agentName} />;
        return <span key={i} className={isMe ? "text-white" : "text-[#1a1c1c]"}>{p.content}</span>;
      })}
    </>
  );
}

// ─── Notification sound (Web Audio API — no external files needed) ────────────

function playPing() {
  try {
    type AudioCtxCtor = typeof AudioContext;
    const Ctx: AudioCtxCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: AudioCtxCtor }).webkitAudioContext;
    const ctx  = new Ctx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Soft descending "ding"
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch { /* AudioContext unavailable — silent fallback */ }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user: currentUser } = useAuth();
  const { tickets } = useData();

  const [members,      setMembers]      = useState<TeamMember[]>([]);
  const [convMeta,     setConvMeta]     = useState<Record<string, ConvMeta>>({});
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [mobileView,   setMobileView]   = useState<"list" | "chat">("list");
  const [input,        setInput]        = useState("");
  const [trigger,      setTrigger]      = useState<"ticket" | "agent" | null>(null);
  const [triggerQuery, setTriggerQuery] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [sending,      setSending]      = useState(false);

  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const messagesEnd     = useRef<HTMLDivElement>(null);
  // Track previous counts so we don't ping on initial load
  const prevMsgCountRef = useRef(-1);
  const prevUnreadRef   = useRef(-1);
  // Typing indicator
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load team members from Firestore users collection ─────────────────────
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(collection(db, "users"), snap => {
      const all = snap.docs
        .map(d => d.data() as TeamMember)
        .filter(m => m.uid !== currentUser.uid)
        .sort((a, b) => a.name.localeCompare(b.name));
      setMembers(all);
      // Auto-select first member if nothing selected yet
      setSelectedId(prev => prev ?? (all[0]?.uid ?? null));
    });
  }, [currentUser]);

  // ── Load conversation metadata (for previews + unread badges) ─────────────
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.uid)
    );
    return onSnapshot(q, snap => {
      const meta: Record<string, ConvMeta> = {};
      snap.docs.forEach(d => {
        const data = d.data() as ConvMeta;
        const otherId = data.participants.find(p => p !== currentUser.uid);
        if (otherId) meta[otherId] = data;
      });
      setConvMeta(meta);
    });
  }, [currentUser]);

  // ── Load messages for the selected conversation ────────────────────────────
  useEffect(() => {
    if (!selectedId || !currentUser) return;
    setMessages([]); // clear while loading
    prevMsgCountRef.current = -1; // reset so first batch never triggers a ping
    const cid = convDocId(currentUser.uid, selectedId);
    const q = query(
      collection(db, "conversations", cid, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      const newMessages = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      // Play ping when a new message arrives from the other person
      if (prevMsgCountRef.current >= 0 && newMessages.length > prevMsgCountRef.current) {
        const latest = newMessages[newMessages.length - 1];
        if (latest?.senderId !== currentUser.uid) playPing();
      }
      prevMsgCountRef.current = newMessages.length;
      setMessages(newMessages);
    });
    // Mark this conversation as read
    updateDoc(doc(db, "conversations", cid), {
      [`unread.${currentUser.uid}`]: 0,
    }).catch(() => {/* doc may not exist yet — that's fine */});
    return unsub;
  }, [selectedId, currentUser]);

  // ── Subscribe to typing indicators for active conversation ────────────────
  useEffect(() => {
    if (!selectedId || !currentUser) { setTypingNames([]); return; }
    const cid = convDocId(currentUser.uid, selectedId);
    return onSnapshot(collection(db, "conversations", cid, "typing"), snap => {
      const now = Date.now();
      const names: string[] = [];
      snap.docs.forEach(d => {
        if (d.id === currentUser.uid) return;
        const data = d.data() as { name: string; at: string };
        if (now - new Date(data.at).getTime() < 5000) names.push(data.name);
      });
      setTypingNames(names);
    });
  }, [selectedId, currentUser]);

  // ── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Member names for @mention autocomplete ────────────────────────────────
  const memberNames = useMemo(() => members.map(m => m.name), [members]);

  // ── Input handling ─────────────────────────────────────────────────────────
  function handleInput(val: string) {
    setInput(val);
    const last = val.split(/\s/).pop() ?? "";
    if (last.startsWith("#"))      { setTrigger("ticket"); setTriggerQuery(last.slice(1)); }
    else if (last.startsWith("@")) { setTrigger("agent");  setTriggerQuery(last.slice(1)); }
    else                           { setTrigger(null);     setTriggerQuery(""); }

    // Broadcast typing indicator
    if (selectedId && currentUser && val.trim()) {
      const cid = convDocId(currentUser.uid, selectedId);
      setDoc(doc(db, "conversations", cid, "typing", currentUser.uid), {
        name: currentUser.name,
        at: new Date().toISOString(),
      }).catch(() => {});
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        deleteDoc(doc(db, "conversations", cid, "typing", currentUser.uid)).catch(() => {});
      }, 3000);
    }
  }

  function insertTicket(t: Ticket) {
    const words = input.split(/\s/);
    words[words.length - 1] = `#${t.id}`;
    setInput(words.join(" ") + " ");
    setTrigger(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function insertMember(m: TeamMember) {
    const words = input.split(/\s/);
    words[words.length - 1] = `@${m.name}`;
    setInput(words.join(" ") + " ");
    setTrigger(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !currentUser || !selectedId || sending) return;
    setSending(true);
    try {
      const cid = convDocId(currentUser.uid, selectedId);
      const ts  = nowTime();
      const iso = new Date().toISOString();

      // 1. Write message to subcollection
      await addDoc(collection(db, "conversations", cid, "messages"), {
        senderId: currentUser.uid,
        text,
        timestamp: ts,
        createdAt: iso,
      });

      // 2. Upsert conversation metadata
      await setDoc(doc(db, "conversations", cid), {
        participants: [currentUser.uid, selectedId].sort(),
        lastMessage:  text.slice(0, 80),
        lastSenderId: currentUser.uid,
        updatedAt:    iso,
      }, { merge: true });

      // 3. Increment recipient's unread (dot-notation works in updateDoc)
      await updateDoc(doc(db, "conversations", cid), {
        [`unread.${selectedId}`]: fsIncrement(1),
      });

      setInput("");
      setTrigger(null);
      // Clear typing indicator
      if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
      deleteDoc(doc(db, "conversations", cid, "typing", currentUser.uid)).catch(() => {});
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === "Escape") { setTrigger(null); }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const selectedMember = members.find(m => m.uid === selectedId) ?? null;

  const sortedMembers = [...members].filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const filteredTickets = tickets.filter(t =>
    t.id.toLowerCase().includes(triggerQuery.toLowerCase()) ||
    t.issue.toLowerCase().includes(triggerQuery.toLowerCase()) ||
    t.customer.toLowerCase().includes(triggerQuery.toLowerCase())
  ).slice(0, 6);

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(triggerQuery.toLowerCase())
  ).slice(0, 5);

  const totalUnread = Object.values(convMeta).reduce((sum, c) =>
    sum + ((c.unread?.[currentUser?.uid ?? ""] as number) ?? 0), 0
  );

  // ── Ping when unread count rises (covers background conversations) ─────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (prevUnreadRef.current < 0) { prevUnreadRef.current = totalUnread; return; }
    if (totalUnread > prevUnreadRef.current) playPing();
    prevUnreadRef.current = totalUnread;
  }, [totalUnread]);

  function lastMsgPreview(uid: string) {
    const meta = convMeta[uid];
    if (!meta?.lastMessage) return null;
    const isMe = meta.lastSenderId === currentUser?.uid;
    const ts = meta.updatedAt
      ? new Date(meta.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    return { prefix: isMe ? "You: " : "", text: meta.lastMessage, ts };
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>

      {/* Header */}
      <div className="mb-5 flex-shrink-0">
        <p className="text-label-caps text-[#48484a] mb-1">Team</p>
        <div className="flex items-center gap-3">
          <h1 className="text-display text-[#1a1c1c]">Messages</h1>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold gradient-primary text-white">
              {totalUnread} unread
            </span>
          )}
        </div>
      </div>

      {/* Chat layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5 min-h-0">

        {/* ── LEFT: Team member list ── */}
        <div
          className={`${mobileView === "chat" ? "hidden" : "flex"} md:flex flex-col rounded-2xl overflow-hidden min-h-0`}
          style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>

          <div className="p-3 flex-shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#48484a]" />
              <input type="text" placeholder="Search team..."
                value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                style={{ background: "var(--surface-low)" }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
            {sortedMembers.length === 0 && (
              <div className="py-12 text-center text-xs text-[#48484a]">
                No other team members yet
              </div>
            )}

            {sortedMembers.map(member => {
              const preview      = lastMsgPreview(member.uid);
              const unreadCount  = (convMeta[member.uid]?.unread?.[currentUser?.uid ?? ""] as number) ?? 0;
              const isSelected   = selectedId === member.uid;
              const color        = getMemberColor(member.uid);
              const initials     = getInitials(member.name);

              return (
                <button key={member.uid}
                  onClick={() => { setSelectedId(member.uid); setMobileView("chat"); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-150"
                  style={{ background: isSelected ? "var(--surface-low)" : "transparent" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface-low)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>

                  <div className="relative flex-shrink-0">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} className="w-9 h-9 rounded-xl object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-semibold"
                        style={{ background: color }}>
                        {initials}
                      </div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${member.online ? "bg-emerald-400" : "bg-slate-300"}`}
                      style={{ borderColor: isSelected ? "var(--surface-low)" : "var(--surface-lowest)" }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium truncate text-[#1a1c1c]">{member.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                        {preview && <span className="text-[10px] text-[#48484a]">{preview.ts}</span>}
                        {unreadCount > 0 && (
                          <span className="w-4 h-4 rounded-full gradient-primary text-white text-[9px] font-bold flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-[#48484a] truncate">
                      {preview
                        ? <><span className={preview.prefix === "You: " ? "opacity-60" : ""}>{preview.prefix}</span>{preview.text}</>
                        : <span className="capitalize">{member.role}</span>
                      }
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Chat area ── */}
        <div
          className={`${mobileView === "list" ? "hidden" : "flex"} md:flex flex-col rounded-2xl overflow-hidden min-h-0`}
          style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 md:px-6 py-4 flex-shrink-0"
            style={{ background: "var(--surface-low)", borderBottom: "1px solid rgba(204,195,215,0.1)" }}>
            <button onClick={() => setMobileView("list")}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-[#48484a] hover:bg-white transition-colors flex-shrink-0">
              <ArrowLeft size={16} />
            </button>
            {selectedMember ? (
              <>
                <div className="relative">
                  {selectedMember.photo ? (
                    <img src={selectedMember.photo} alt={selectedMember.name}
                      className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold"
                      style={{ background: getMemberColor(selectedMember.uid) }}>
                      {getInitials(selectedMember.name)}
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${selectedMember.online ? "bg-emerald-400" : "bg-slate-300"}`}
                    style={{ borderColor: "var(--surface-low)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1c1c]">{selectedMember.name}</p>
                  <p className={`text-xs capitalize ${selectedMember.online ? "text-emerald-600" : "text-[#48484a]"}`}>
                    {selectedMember.role} · {selectedMember.online ? "Online" : "Offline"}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#48484a]">Select a team member to start messaging</p>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
            {!selectedMember || messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center mb-3 opacity-80">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <p className="text-sm font-medium text-[#1a1c1c] mb-1">
                  {selectedMember ? `No messages with ${selectedMember.name} yet` : "Select a team member"}
                </p>
                <p className="text-xs text-[#48484a]">
                  Type <span className="font-mono">#</span> for tickets, <span className="font-mono">@</span> for agents
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isMe      = msg.senderId === currentUser?.uid;
                  const prevMsg   = messages[idx - 1];
                  const sameGroup = prevMsg && prevMsg.senderId === msg.senderId;
                  const parts     = parseParts(msg.text, memberNames);

                  return (
                    <div key={msg.id}
                      className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} ${sameGroup ? "mt-0.5" : "mt-3"}`}>

                      {/* Avatar — only on first in group */}
                      {!isMe && selectedMember && (
                        <div className="w-6 h-6 flex-shrink-0">
                          {!sameGroup && (
                            selectedMember.photo ? (
                              <img src={selectedMember.photo} alt={selectedMember.name}
                                className="w-6 h-6 rounded-lg object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-semibold"
                                style={{ background: getMemberColor(selectedMember.uid) }}>
                                {getInitials(selectedMember.name)}
                              </div>
                            )
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col gap-0.5 max-w-[68%] ${isMe ? "items-end" : "items-start"}`}>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed flex flex-wrap items-center gap-1 ${
                          isMe ? "rounded-br-sm gradient-primary" : "rounded-bl-sm"
                        }`}
                          style={!isMe ? { background: "var(--surface-low)" } : {}}>
                          <RenderParts parts={parts} isMe={isMe} />
                        </div>
                        <span className="text-[10px] text-[#48484a] px-1">{msg.timestamp}</span>
                      </div>
                    </div>
                  );
                })}
                {typingNames.length > 0 && (
                  <div className="flex items-center gap-2 mt-1 ml-8">
                    <div className="px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-2"
                      style={{ background: "var(--surface-low)" }}>
                      <span className="flex gap-0.5 items-end">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#48484a] animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#48484a] animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#48484a] animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      <span className="text-xs text-[#48484a]">{typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEnd} />
              </>
            )}
          </div>

          {/* Input area */}
          {selectedMember && (
            <div className="flex-shrink-0 p-4 relative"
              style={{ borderTop: "1px solid rgba(204,195,215,0.1)" }}>

              {/* Ticket picker dropdown */}
              {trigger === "ticket" && filteredTickets.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-2 rounded-2xl overflow-hidden z-20"
                  style={{ background: "var(--surface-lowest)", boxShadow: "0 -8px 32px rgba(26,28,28,0.12)" }}>
                  <div className="px-4 py-2.5 flex items-center gap-1.5"
                    style={{ background: "var(--surface-low)", borderBottom: "1px solid rgba(204,195,215,0.1)" }}>
                    <Hash size={11} className="text-purple-500" />
                    <span className="text-[10px] font-semibold text-[#48484a] uppercase tracking-wide">Tickets</span>
                    {triggerQuery && <span className="text-[10px] text-purple-500 font-mono">#{triggerQuery}</span>}
                  </div>
                  {filteredTickets.map(t => (
                    <button key={t.id} onClick={() => insertTicket(t)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-all"
                      style={{ background: "transparent" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-low)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span className="text-xs font-bold text-purple-500 w-[72px] flex-shrink-0">{t.id}</span>
                      <span className="text-xs text-[#1a1c1c] flex-1 truncate">{t.issue}</span>
                      <span className="text-xs text-[#48484a] truncate hidden sm:block">{t.customer}</span>
                      <PriorityPill priority={t.priority} />
                      <StatusPill status={t.status} />
                    </button>
                  ))}
                </div>
              )}

              {/* Agent mention dropdown */}
              {trigger === "agent" && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-2 rounded-2xl overflow-hidden z-20"
                  style={{ background: "var(--surface-lowest)", boxShadow: "0 -8px 32px rgba(26,28,28,0.12)" }}>
                  <div className="px-4 py-2.5 flex items-center gap-1.5"
                    style={{ background: "var(--surface-low)", borderBottom: "1px solid rgba(204,195,215,0.1)" }}>
                    <AtSign size={11} className="text-purple-500" />
                    <span className="text-[10px] font-semibold text-[#48484a] uppercase tracking-wide">Mention agent</span>
                  </div>
                  {filteredMembers.map(m => (
                    <button key={m.uid} onClick={() => insertMember(m)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-all"
                      style={{ background: "transparent" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-low)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div className="relative flex-shrink-0">
                        {m.photo ? (
                          <img src={m.photo} alt={m.name} className="w-7 h-7 rounded-lg object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-semibold"
                            style={{ background: getMemberColor(m.uid) }}>
                            {getInitials(m.name)}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border ${m.online ? "bg-emerald-400" : "bg-slate-300"}`}
                          style={{ borderColor: "var(--surface-lowest)" }} />
                      </div>
                      <span className="text-sm font-medium text-[#1a1c1c]">{m.name}</span>
                      <span className="text-xs text-[#48484a] capitalize">{m.role}</span>
                      <span className={`ml-auto text-xs ${m.online ? "text-emerald-500" : "text-[#48484a]"}`}>
                        {m.online ? "Online" : "Offline"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => { setInput(v => v + "#"); setTrigger("ticket"); setTriggerQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }}
                  title="Tag a ticket (#)"
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-[#48484a] hover:text-purple-600 flex-shrink-0 transition-colors"
                  style={{ background: "var(--surface-low)" }}>
                  <Hash size={15} />
                </button>
                <button
                  onClick={() => { setInput(v => v + "@"); setTrigger("agent"); setTriggerQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }}
                  title="Mention an agent (@)"
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-[#48484a] hover:text-purple-600 flex-shrink-0 transition-colors"
                  style={{ background: "var(--surface-low)" }}>
                  <AtSign size={15} />
                </button>
                <textarea ref={inputRef} rows={1} value={input}
                  onChange={e => handleInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${selectedMember.name}… # for tickets, @ for agents`}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none resize-none focus:ring-2 focus:ring-purple-200 transition-all placeholder:text-[#48484a]"
                  style={{ background: "var(--surface-low)", maxHeight: "120px" }}
                  onFocus={e => e.target.style.background = "var(--surface-lowest)"}
                  onBlur={e => e.target.style.background = "var(--surface-low)"} />
                <button onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="w-9 h-9 flex items-center justify-center rounded-xl gradient-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                  <Send size={14} />
                </button>
              </div>

              <p className="text-[10px] text-[#48484a] mt-2 px-1">
                <span className="font-mono font-bold">#</span> tag ticket ·{" "}
                <span className="font-mono font-bold">@</span> mention agent ·{" "}
                <span className="font-mono font-bold">Enter</span> send ·{" "}
                <span className="font-mono font-bold">Shift+Enter</span> new line
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
