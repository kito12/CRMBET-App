"use client";

import { useState } from "react";
import { User, Bell, Monitor, Info, Save, Zap } from "lucide-react";

export default function SettingsPage() {
  const [profile, setProfile] = useState({
    name: "John D.",
    email: "john@betcrm.com",
    role: "Senior Agent",
    timezone: "UTC+0",
  });

  const [notifications, setNotifications] = useState({
    newTickets: true,
    assignedToMe: true,
    statusChanges: false,
    dailyDigest: true,
  });

  const [crm, setCrm] = useState({
    name: "BetCRM",
    slaTarget: "10",
    headOfficeName: "Head Office CRM",
    defaultAgent: "Unassigned",
  });

  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
      <button
        onClick={onToggle}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${on ? "bg-purple-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    );
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none focus:ring-2 focus:ring-purple-200 transition-all";
  const labelClass = "block text-xs font-medium text-[#48484a] mb-1.5 uppercase tracking-wide";

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="mb-8">
        <p className="text-label-caps text-[#48484a] mb-1">Account</p>
        <h1 className="text-display text-[#1a1c1c]">Settings</h1>
        <p className="text-sm text-[#48484a] mt-1">Manage your profile and preferences</p>
      </div>

      {/* Profile */}
      <div className="rounded-2xl p-6 mb-5" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <User size={13} className="text-white" />
          </div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">Profile</h2>
        </div>
        <div className="flex items-center gap-4 mb-6 p-4 rounded-xl" style={{ background: "var(--surface-low)" }}>
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">JD</div>
          <div>
            <p className="text-sm font-semibold text-[#1a1c1c]">{profile.name}</p>
            <p className="text-xs text-[#48484a]">{profile.role} · {profile.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Full Name", key: "name", type: "text" },
            { label: "Email", key: "email", type: "email" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input type={type} value={profile[key as keyof typeof profile]}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                className={inputClass} style={{ background: "var(--surface-low)" }}
                onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
                onBlur={(e) => (e.target.style.background = "var(--surface-low)")} />
            </div>
          ))}
          <div>
            <label className={labelClass}>Role</label>
            <select value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}>
              {["Agent", "Senior Agent", "Team Lead"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}>
              {["UTC-8", "UTC-5", "UTC+0", "UTC+1", "UTC+2", "UTC+3", "UTC+4", "UTC+5:30", "UTC+8"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl p-6 mb-5" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <Bell size={13} className="text-white" />
          </div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">Notifications</h2>
        </div>
        <div className="flex flex-col gap-3">
          {([
            { key: "newTickets",    label: "New Tickets",    sub: "Alert when a new ticket is created" },
            { key: "assignedToMe",  label: "Assigned to Me", sub: "Alert when a ticket is assigned to you" },
            { key: "statusChanges", label: "Status Changes", sub: "Alert when a ticket status changes" },
            { key: "dailyDigest",   label: "Daily Digest",   sub: "Receive a summary email each morning" },
          ] as const).map(({ key, label, sub }) => (
            <div key={key} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
              <div>
                <p className="text-sm font-medium text-[#1a1c1c]">{label}</p>
                <p className="text-xs text-[#48484a]">{sub}</p>
              </div>
              <Toggle on={notifications[key]} onToggle={() => setNotifications(n => ({ ...n, [key]: !n[key] }))} />
            </div>
          ))}
        </div>
      </div>

      {/* CRM Settings */}
      <div className="rounded-2xl p-6 mb-5" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <Monitor size={13} className="text-white" />
          </div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">CRM Settings</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>CRM Name</label>
            <input value={crm.name} onChange={(e) => setCrm({ ...crm, name: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}
              onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={(e) => (e.target.style.background = "var(--surface-low)")} />
          </div>
          <div>
            <label className={labelClass}>SLA Target (minutes)</label>
            <input type="number" value={crm.slaTarget} onChange={(e) => setCrm({ ...crm, slaTarget: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}
              onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={(e) => (e.target.style.background = "var(--surface-low)")} />
          </div>
          <div>
            <label className={labelClass}>Head Office CRM Name</label>
            <input value={crm.headOfficeName} onChange={(e) => setCrm({ ...crm, headOfficeName: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}
              onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={(e) => (e.target.style.background = "var(--surface-low)")} />
          </div>
          <div>
            <label className={labelClass}>Default Assigned Agent</label>
            <select value={crm.defaultAgent} onChange={(e) => setCrm({ ...crm, defaultAgent: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}>
              {["Unassigned", "Sarah K.", "James R.", "Tom H.", "Mia S.", "Daniel P.", "Omar K.", "Yuki T."].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="rounded-2xl p-6 mb-8" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <Info size={13} className="text-white" />
          </div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">About</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1a1c1c]">BetCRM v1.0</p>
            <p className="text-xs text-[#48484a]">Customer support platform for betting operations</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pb-8">
        <button onClick={handleSave}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all ${saved ? "bg-emerald-500" : "gradient-primary hover:opacity-90"}`}>
          <Save size={14} /> {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
