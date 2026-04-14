"use client";

import { useState } from "react";
import { Plus, Search, Users, Clock, Star } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { InputField, SelectField } from "@/components/ui/FormField";

type AgentStatus = "Online" | "Offline" | "On Break";
type AgentRole = "Team Lead" | "Senior Agent" | "Agent";

interface Agent {
  id: number;
  name: string;
  initials: string;
  role: AgentRole;
  status: AgentStatus;
  ticketsToday: number;
  satisfaction: number;
  color: string;
}

const initialAgents: Agent[] = [
  { id: 1, name: "Sarah Kim", initials: "SK", role: "Team Lead", status: "Online", ticketsToday: 18, satisfaction: 97, color: "from-purple-500 to-violet-600" },
  { id: 2, name: "James Rivera", initials: "JR", role: "Senior Agent", status: "Online", ticketsToday: 14, satisfaction: 95, color: "from-blue-500 to-indigo-600" },
  { id: 3, name: "Tom Hughes", initials: "TH", role: "Agent", status: "On Break", ticketsToday: 9, satisfaction: 91, color: "from-indigo-400 to-purple-500" },
  { id: 4, name: "Mia Santos", initials: "MS", role: "Senior Agent", status: "Online", ticketsToday: 12, satisfaction: 93, color: "from-violet-500 to-purple-700" },
  { id: 5, name: "Daniel Park", initials: "DP", role: "Agent", status: "Online", ticketsToday: 7, satisfaction: 88, color: "from-blue-400 to-cyan-500" },
  { id: 6, name: "Chloe Martin", initials: "CM", role: "Agent", status: "Offline", ticketsToday: 0, satisfaction: 90, color: "from-purple-400 to-pink-500" },
  { id: 7, name: "Omar Khalil", initials: "OK", role: "Senior Agent", status: "Online", ticketsToday: 11, satisfaction: 94, color: "from-emerald-500 to-teal-600" },
  { id: 8, name: "Yuki Tanaka", initials: "YT", role: "Agent", status: "On Break", ticketsToday: 6, satisfaction: 89, color: "from-amber-500 to-orange-500" },
];

const gradientPool = [
  "from-purple-500 to-violet-600", "from-blue-500 to-indigo-600",
  "from-rose-500 to-pink-600", "from-teal-500 to-cyan-600",
  "from-amber-500 to-orange-500", "from-emerald-500 to-teal-600",
  "from-indigo-400 to-purple-500", "from-violet-500 to-purple-700",
];

const statusDot: Record<AgentStatus, string> = {
  Online: "bg-emerald-400",
  Offline: "bg-slate-300",
  "On Break": "bg-amber-400",
};

const rolePill: Record<AgentRole, string> = {
  "Team Lead": "bg-purple-50 text-purple-700",
  "Senior Agent": "bg-blue-50 text-blue-700",
  Agent: "bg-slate-100 text-slate-600",
};

const emptyForm = { name: "", email: "", role: "Agent" as AgentRole, status: "Online" as AgentStatus };

export default function UsersPage() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Partial<typeof emptyForm>>({});

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.role.toLowerCase().includes(search.toLowerCase())
  );

  const online = agents.filter((a) => a.status === "Online").length;
  const avgSat = Math.round(agents.reduce((s, a) => s + a.satisfaction, 0) / agents.length);

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  function validate() {
    const e: Partial<typeof emptyForm> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const newAgent: Agent = {
      id: Date.now(),
      name: form.name.trim(),
      initials: getInitials(form.name),
      role: form.role,
      status: form.status,
      ticketsToday: 0,
      satisfaction: 100,
      color: gradientPool[agents.length % gradientPool.length],
    };

    setAgents((prev) => [newAgent, ...prev]);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(false);
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-label-caps text-[#48484a] mb-1">People</p>
          <h1 className="text-display text-[#1a1c1c]">Support Team</h1>
          <p className="text-sm text-[#48484a] mt-1">Manage agents and roles</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="gradient-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity shadow-ambient"
        >
          <Plus size={15} /> Add Agent
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          { icon: Users, label: "TOTAL AGENTS", value: agents.length.toString(), sub: `${online} currently online`, color: "text-purple-600", bg: "bg-purple-50" },
          { icon: Clock, label: "ONLINE NOW", value: online.toString(), sub: `${agents.length - online} offline or on break`, color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: Star, label: "AVG SATISFACTION", value: `${avgSat}%`, sub: "Based on today's tickets", color: "text-blue-600", bg: "bg-blue-50" },
        ].map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="rounded-2xl p-6" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
            <p className="text-2xl font-bold text-[#1a1c1c] tracking-tight">{value}</p>
            <p className="text-xs text-[#48484a] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#48484a]" />
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] placeholder:text-[#48484a] outline-none focus:ring-2 focus:ring-purple-200 transition-all"
          style={{ background: "var(--surface-low)" }}
          onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
          onBlur={(e) => (e.target.style.background = "var(--surface-low)")}
        />
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-4 gap-5">
        {filtered.map((agent) => (
          <div
            key={agent.id}
            className="rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
            style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 16px 60px 0 rgba(26,28,28,0.10)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 8px 40px 0 rgba(26,28,28,0.06)")}
          >
            <div className="relative w-12 h-12 mb-4">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-white text-sm font-semibold`}>
                {agent.initials}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot[agent.status]}`} />
            </div>

            <h3 className="text-sm font-semibold text-[#1a1c1c] tracking-tight mb-1">{agent.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-4 ${rolePill[agent.role]}`}>
              {agent.role}
            </span>

            <p className="text-label-caps text-[#48484a] mb-1">STATUS</p>
            <p className="text-xs text-[#48484a] mb-4">{agent.status}</p>

            <div className="grid grid-cols-2 gap-3 pt-4" style={{ borderTop: "1px solid rgba(204,195,215,0.15)" }}>
              <div>
                <p className="text-label-caps text-[#48484a] mb-1">TODAY</p>
                <p className="text-base font-bold text-[#1a1c1c]">{agent.ticketsToday}</p>
                <p className="text-xs text-[#48484a]">tickets</p>
              </div>
              <div>
                <p className="text-label-caps text-[#48484a] mb-1">CSAT</p>
                <p className="text-base font-bold text-[#1a1c1c]">{agent.satisfaction}%</p>
                <p className="text-xs text-[#48484a]">score</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Agent Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setErrors({}); }} title="Add Agent" subtitle="Create a new support team member">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <InputField label="Full Name" placeholder="Jane Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <InputField label="Email" type="email" placeholder="jane@betcrm.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AgentRole })}>
              {(["Team Lead", "Senior Agent", "Agent"] as AgentRole[]).map((r) => <option key={r}>{r}</option>)}
            </SelectField>

            <SelectField label="Initial Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AgentStatus })}>
              {(["Online", "Offline", "On Break"] as AgentStatus[]).map((s) => <option key={s}>{s}</option>)}
            </SelectField>
          </div>

          {/* Preview avatar */}
          {form.name && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradientPool[agents.length % gradientPool.length]} flex items-center justify-center text-white text-xs font-semibold`}>
                {getInitials(form.name)}
              </div>
              <div>
                <p className="text-sm font-medium text-[#1a1c1c]">{form.name}</p>
                <p className="text-xs text-[#48484a]">{form.role}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setModalOpen(false); setErrors({}); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#48484a] transition-colors"
              style={{ background: "var(--surface-low)" }}>
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity">
              Add Agent
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
