"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Hash, AtSign, Search, ArrowLeft } from "lucide-react";
import { tickets } from "@/lib/data";
import type { Ticket } from "@/lib/data";
import { StatusPill, PriorityPill } from "@/components/ui/StatusPill";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = "online" | "away" | "busy" | "offline";

interface ChatAgent {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: AgentStatus;
  color: string;
}

type Part =
  | { type: "text"; content: string }
  | { type: "ticket"; ticketId: string }
  | { type: "agent"; agentName: string };

interface Message {
  id: string;
  senderId: string; // agent id or "me"
  parts: Part[];
  timestamp: string;
}

type Conversations = Record<string, Message[]>;

// ─── Static data ──────────────────────────────────────────────────────────────

const agents: ChatAgent[] = [
  { id: "sarah",  name: "Sarah K.",  initials: "SK", role: "Senior Agent",  status: "online",  color: "#7131d6" },
  { id: "james",  name: "James R.",  initials: "JR", role: "Agent",         status: "online",  color: "#0058bf" },
  { id: "tom",    name: "Tom H.",    initials: "TH", role: "Agent",         status: "away",    color: "#059669" },
  { id: "mia",    name: "Mia S.",    initials: "MS", role: "Agent",         status: "online",  color: "#db2777" },
  { id: "daniel", name: "Daniel P.", initials: "DP", role: "Junior Agent",  status: "offline", color: "#d97706" },
  { id: "omar",   name: "Omar K.",   initials: "OK", role: "Agent",         status: "busy",    color: "#dc2626" },
  { id: "yuki",   name: "Yuki T.",   initials: "YT", role: "Senior Agent",  status: "online",  color: "#0891b2" },
];

const statusDot: Record<AgentStatus, string> = {
  online:  "bg-emerald-400",
  away:    "bg-amber-400",
  busy:    "bg-red-400",
  offline: "bg-slate-400",
};

const statusLabel: Record<AgentStatus, string> = {
  online: "Online", away: "Away", busy: "Busy", offline: "Offline",
};

const statusOrder: Record<AgentStatus, number> = {
  online: 0, away: 1, busy: 2, offline: 3,
};

// ─── Message parsing ──────────────────────────────────────────────────────────

function parseParts(text: string): Part[] {
  const escaped = agents.map(a => a.name.replace(/\./g, "\\.")).join("|");
  const regex = new RegExp(`(#TKT-\\d+|@(?:${escaped}))`, "g");
  return text.split(regex).filter(s => s.length > 0).map(s => {
    if (s.startsWith("#TKT-")) return { type: "ticket" as const, ticketId: s.slice(1) };
    if (s.startsWith("@"))     return { type: "agent"  as const, agentName: s.slice(1) };
    return                            { type: "text"   as const, content: s };
  });
}

function makeMsg(id: string, senderId: string, text: string, ts: string): Message {
  return { id, senderId, parts: parseParts(text), timestamp: ts };
}

// ─── Seed conversations ───────────────────────────────────────────────────────

const seedConversations: Conversations = {
  sarah: [
    makeMsg("s1", "sarah", "Hey, can you check #TKT-1042? Marcus is getting impatient about his withdrawal", "09:14"),
    makeMsg("s2", "me",    "On it — looks like a KYC hold. Escalating now", "09:15"),
    makeMsg("s3", "sarah", "He's VIP so let's prioritise. Keep me posted", "09:16"),
  ],
  james: [
    makeMsg("j1", "james", "Can you cover #TKT-1041? Stepping out for 30 mins", "08:55"),
    makeMsg("j2", "me",    "Sure, I'll pick it up", "08:56"),
    makeMsg("j3", "james", "Cheers 👍", "08:57"),
  ],
  tom:    [],
  mia: [
    makeMsg("m1", "me",  "Hey @Mia S. what's the process for bonus disputes again?", "Yesterday"),
    makeMsg("m2", "mia", "Check the playbook under Promotions > Dispute Flow. Tag me if it's over £500", "Yesterday"),
  ],
  daniel: [],
  omar:   [],
  yuki: [
    makeMsg("y1", "yuki", "Heads up — going offline in 10. My open tickets are #TKT-1034 and #TKT-1019", "16:20"),
    makeMsg("y2", "me",   "Got it, I'll keep an eye on them", "16:21"),
  ],
};

// Conversations that have unread messages (seeded)
const seedUnread: Record<string, number> = { sarah: 1, yuki: 1 };

// ─── Sub-components ───────────────────────────────────────────────────────────

function TicketCard({ ticketId }: { ticketId: string }) {
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
        return (
          <span key={i} className={isMe ? "text-white" : "text-[#1a1c1c]"}>
            {p.content}
          </span>
        );
      })}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [selectedId, setSelectedId]       = useState("sarah");
  const [mobileView, setMobileView]       = useState<"list" | "chat">("list");
  const [conversations, setConversations] = useState<Conversations>(seedConversations);
  const [unread, setUnread]               = useState<Record<string, number>>(seedUnread);
  const [input, setInput]                 = useState("");
  const [trigger, setTrigger]             = useState<"ticket" | "agent" | null>(null);
  const [triggerQuery, setTriggerQuery]   = useState("");
  const [agentSearch, setAgentSearch]     = useState("");

  const inputRef      = useRef<HTMLTextAreaElement>(null);
  const messagesEnd   = useRef<HTMLDivElement>(null);

  const selectedAgent = agents.find(a => a.id === selectedId)!;
  const messages      = conversations[selectedId] ?? [];

  // Clear unread when switching conversation
  useEffect(() => {
    setUnread(prev => ({ ...prev, [selectedId]: 0 }));
  }, [selectedId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Input handling ──────────────────────────────────────────────────────────

  function handleInput(val: string) {
    setInput(val);
    const last = val.split(/\s/).pop() ?? "";
    if (last.startsWith("#")) {
      setTrigger("ticket"); setTriggerQuery(last.slice(1));
    } else if (last.startsWith("@")) {
      setTrigger("agent"); setTriggerQuery(last.slice(1));
    } else {
      setTrigger(null); setTriggerQuery("");
    }
  }

  function insertTicket(t: Ticket) {
    const words = input.split(/\s/);
    words[words.length - 1] = `#${t.id}`;
    setInput(words.join(" ") + " ");
    setTrigger(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function insertAgent(a: ChatAgent) {
    const words = input.split(/\s/);
    words[words.length - 1] = `@${a.name}`;
    setInput(words.join(" ") + " ");
    setTrigger(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const msg: Message = { id: Date.now().toString(), senderId: "me", parts: parseParts(text), timestamp: ts };
    setConversations(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] ?? []), msg] }));
    setInput(""); setTrigger(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === "Escape") { setTrigger(null); }
  }

  // ── Filtered lists ──────────────────────────────────────────────────────────

  const sortedAgents = [...agents]
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
    .filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
                 a.role.toLowerCase().includes(agentSearch.toLowerCase()));

  const filteredTickets = tickets.filter(t =>
    t.id.toLowerCase().includes(triggerQuery.toLowerCase()) ||
    t.issue.toLowerCase().includes(triggerQuery.toLowerCase()) ||
    t.customer.toLowerCase().includes(triggerQuery.toLowerCase())
  ).slice(0, 6);

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(triggerQuery.toLowerCase())
  ).slice(0, 5);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function lastMsgPreview(agentId: string) {
    const msgs = conversations[agentId] ?? [];
    const last = msgs[msgs.length - 1];
    if (!last) return null;
    const raw = last.parts.map(p =>
      p.type === "text" ? p.content : p.type === "ticket" ? `#${p.ticketId}` : `@${p.agentName}`
    ).join("");
    return { prefix: last.senderId === "me" ? "You: " : "", text: raw, ts: last.timestamp };
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>

      {/* Page header */}
      <div className="mb-5 flex-shrink-0">
        <p className="text-label-caps text-[#48484a] mb-1">Team</p>
        <div className="flex items-center gap-3">
          <h1 className="text-display text-[#1a1c1c]">Messages</h1>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold gradient-primary text-white">{totalUnread} unread</span>
          )}
        </div>
      </div>

      {/* Chat layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5 min-h-0">

        {/* ── LEFT: Agent list ── */}
        <div className={`${mobileView === "chat" ? "hidden" : "flex"} md:flex flex-col rounded-2xl overflow-hidden min-h-0`}
          style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>

          <div className="p-3 flex-shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#48484a]" />
              <input type="text" placeholder="Search agents..."
                value={agentSearch} onChange={e => setAgentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                style={{ background: "var(--surface-low)" }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-0.5">
            {sortedAgents.map(agent => {
              const preview = lastMsgPreview(agent.id);
              const u = unread[agent.id] ?? 0;
              const isSelected = selectedId === agent.id;
              return (
                <button key={agent.id} onClick={() => { setSelectedId(agent.id); setMobileView("chat"); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-150"
                  style={{ background: isSelected ? "var(--surface-low)" : "transparent" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface-low)"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>

                  {/* Avatar + status */}
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-semibold"
                      style={{ background: agent.color }}>
                      {agent.initials}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${statusDot[agent.status]}`}
                      style={{ borderColor: isSelected ? "var(--surface-low)" : "var(--surface-lowest)" }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-medium truncate ${u > 0 ? "text-[#1a1c1c]" : "text-[#1a1c1c]"}`}>{agent.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                        {preview && <span className="text-[10px] text-[#48484a]">{preview.ts}</span>}
                        {u > 0 && (
                          <span className="w-4 h-4 rounded-full gradient-primary text-white text-[9px] font-bold flex items-center justify-center">{u}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-[#48484a] truncate">
                      {preview ? <><span className={preview.prefix === "You: " ? "opacity-60" : ""}>{preview.prefix}</span>{preview.text}</> : agent.role}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Chat area ── */}
        <div className={`${mobileView === "list" ? "hidden" : "flex"} md:flex flex-col rounded-2xl overflow-hidden min-h-0`}
          style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 md:px-6 py-4 flex-shrink-0"
            style={{ background: "var(--surface-low)", borderBottom: "1px solid rgba(204,195,215,0.1)" }}>
            <button onClick={() => setMobileView("list")}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-[#48484a] hover:bg-white transition-colors flex-shrink-0">
              <ArrowLeft size={16} />
            </button>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold"
                style={{ background: selectedAgent.color }}>
                {selectedAgent.initials}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${statusDot[selectedAgent.status]}`}
                style={{ borderColor: "var(--surface-low)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1c1c]">{selectedAgent.name}</p>
              <p className="text-xs text-[#48484a]">{selectedAgent.role} · {statusLabel[selectedAgent.status]}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center mb-3 opacity-80">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <p className="text-sm font-medium text-[#1a1c1c] mb-1">No messages yet</p>
                <p className="text-xs text-[#48484a]">Start a conversation — type <span className="font-mono">#</span> for tickets, <span className="font-mono">@</span> for agents</p>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === "me";
                  // Group: hide avatar if same sender as previous
                  const prevMsg = messages[idx - 1];
                  const sameAsPrev = prevMsg && prevMsg.senderId === msg.senderId;

                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} ${sameAsPrev ? "mt-0.5" : "mt-3"}`}>

                      {/* Avatar — only show on first in group */}
                      {!isMe && (
                        <div className="w-6 h-6 flex-shrink-0">
                          {!sameAsPrev && (
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-semibold"
                              style={{ background: selectedAgent.color }}>
                              {selectedAgent.initials}
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col gap-0.5 max-w-[68%] ${isMe ? "items-end" : "items-start"}`}>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed flex flex-wrap items-center gap-1 ${
                          isMe ? "rounded-br-sm gradient-primary" : "rounded-bl-sm"
                        }`}
                          style={!isMe ? { background: "var(--surface-low)" } : {}}>
                          <RenderParts parts={msg.parts} isMe={isMe} />
                        </div>
                        <span className="text-[10px] text-[#48484a] px-1">{msg.timestamp}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEnd} />
              </>
            )}
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 p-4 relative"
            style={{ borderTop: "1px solid rgba(204,195,215,0.1)" }}>

            {/* Ticket picker dropdown */}
            {trigger === "ticket" && filteredTickets.length > 0 && (
              <div className="absolute bottom-full left-4 right-4 mb-2 rounded-2xl overflow-hidden z-20"
                style={{ background: "var(--surface-lowest)", boxShadow: "0 -8px 32px rgba(26,28,28,0.12)" }}>
                <div className="px-4 py-2.5 flex items-center gap-1.5 flex-shrink-0"
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
            {trigger === "agent" && filteredAgents.length > 0 && (
              <div className="absolute bottom-full left-4 right-4 mb-2 rounded-2xl overflow-hidden z-20"
                style={{ background: "var(--surface-lowest)", boxShadow: "0 -8px 32px rgba(26,28,28,0.12)" }}>
                <div className="px-4 py-2.5 flex items-center gap-1.5 flex-shrink-0"
                  style={{ background: "var(--surface-low)", borderBottom: "1px solid rgba(204,195,215,0.1)" }}>
                  <AtSign size={11} className="text-purple-500" />
                  <span className="text-[10px] font-semibold text-[#48484a] uppercase tracking-wide">Mention agent</span>
                </div>
                {filteredAgents.map(a => (
                  <button key={a.id} onClick={() => insertAgent(a)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-all"
                    style={{ background: "transparent" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface-low)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div className="relative flex-shrink-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-semibold"
                        style={{ background: a.color }}>{a.initials}</div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border ${statusDot[a.status]}`}
                        style={{ borderColor: "var(--surface-lowest)" }} />
                    </div>
                    <span className="text-sm font-medium text-[#1a1c1c]">{a.name}</span>
                    <span className="text-xs text-[#48484a]">{a.role}</span>
                    <span className={`ml-auto text-xs ${a.status === "online" ? "text-emerald-500" : a.status === "away" ? "text-amber-500" : a.status === "busy" ? "text-red-500" : "text-slate-400"}`}>
                      {statusLabel[a.status]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">
              <button onClick={() => { setInput(v => v + "#"); setTrigger("ticket"); setTriggerQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }}
                title="Tag a ticket (#)"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-[#48484a] hover:text-purple-600 flex-shrink-0 transition-colors"
                style={{ background: "var(--surface-low)" }}>
                <Hash size={15} />
              </button>
              <button onClick={() => { setInput(v => v + "@"); setTrigger("agent"); setTriggerQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }}
                title="Mention an agent (@)"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-[#48484a] hover:text-purple-600 flex-shrink-0 transition-colors"
                style={{ background: "var(--surface-low)" }}>
                <AtSign size={15} />
              </button>
              <textarea ref={inputRef} rows={1} value={input}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${selectedAgent.name}… type # for tickets, @ for agents`}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none resize-none focus:ring-2 focus:ring-purple-200 transition-all placeholder:text-[#48484a]"
                style={{ background: "var(--surface-low)", maxHeight: "120px" }}
                onFocus={e => e.target.style.background = "var(--surface-lowest)"}
                onBlur={e => e.target.style.background = "var(--surface-low)"} />
              <button onClick={sendMessage} disabled={!input.trim()}
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
        </div>
      </div>
    </div>
  );
}
