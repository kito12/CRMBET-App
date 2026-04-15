"use client";

import { useState, useEffect } from "react";
import {
  User, Bell, Monitor, Info, Save, Zap, ArrowUpCircle,
  MessageSquare, Plus, Pencil, Trash2, Check, X, ChevronDown, Link2, Copy,
} from "lucide-react";
import { useData } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import type { CannedResponse } from "@/lib/data";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
        on ? "bg-purple-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

const AGENTS = ["Unassigned", "Sarah K.", "James R.", "Tom H.", "Mia S.", "Daniel P.", "Omar K.", "Yuki T."];
const CATEGORIES = ["Withdrawal", "Bet Settlement", "Account Access", "Bonus Dispute", "Live Betting", "General", "Other"];

const blankCanned = (): Omit<CannedResponse, "id"> => ({ title: "", category: "General", body: "" });

export default function SettingsPage() {
  const { escalationSettings, setEscalationSettings, cannedResponses, setCannedResponses } = useData();
  const { user, signOut } = useAuth();

  /* ── Profile / Notifications / CRM local state ── */
  const [profile, setProfile] = useState({
    name: user?.name ?? "Agent",
    email: user?.email ?? "",
    role: user?.role === "admin" ? "Team Lead" : "Agent",
    timezone: "UTC+0",
  });
  const [notifications, setNotifications] = useState({
    newTickets: true, assignedToMe: true, statusChanges: false, dailyDigest: true,
  });
  const [crm, setCrm] = useState({
    name: "BetCRM", slaTarget: "10", headOfficeName: "Head Office CRM", defaultAgent: "Unassigned",
  });

  /* ── Public form URL ── */
  const [formUrl, setFormUrl] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  useEffect(() => { setFormUrl(`${window.location.origin}/submit`); }, []);
  function copyUrl() {
    navigator.clipboard.writeText(formUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  }

  /* ── Canned response editing state ── */
  const [editingId, setEditingId] = useState<string | null>(null);   // null = closed, "new" = new form
  const [editDraft, setEditDraft] = useState<Omit<CannedResponse, "id">>(blankCanned());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [cannedSaved, setCannedSaved] = useState(false);

  /* ── Global save toast ── */
  const [saved, setSaved] = useState(false);
  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2000); }


  /* ── Canned CRUD helpers ── */
  function openNew() {
    setEditDraft(blankCanned());
    setEditingId("new");
  }
  function openEdit(cr: CannedResponse) {
    setEditDraft({ title: cr.title, category: cr.category, body: cr.body });
    setEditingId(cr.id);
  }
  function cancelEdit() { setEditingId(null); }
  function saveCanned() {
    if (!editDraft.title.trim() || !editDraft.body.trim()) return;
    if (editingId === "new") {
      setCannedResponses(prev => [...prev, { ...editDraft, id: `cr-${Date.now()}` }]);
    } else {
      setCannedResponses(prev => prev.map(c => c.id === editingId ? { ...c, ...editDraft } : c));
    }
    setEditingId(null);
    setCannedSaved(true);
    setTimeout(() => setCannedSaved(false), 2000);
  }
  function deleteCanned(id: string) {
    setCannedResponses(prev => prev.filter(c => c.id !== id));
    setDeleteConfirm(null);
  }

  const inputClass = "w-full px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none focus:ring-2 focus:ring-purple-200 transition-all";
  const labelClass = "block text-xs font-medium text-[#48484a] mb-1.5 uppercase tracking-wide";
  const cardStyle = { background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" };

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="mb-8">
        <p className="text-label-caps text-[#48484a] mb-1">Account</p>
        <h1 className="text-display text-[#1a1c1c]">Settings</h1>
        <p className="text-sm text-[#48484a] mt-1">Manage your profile, escalation rules and canned responses</p>
      </div>

      {/* ── Profile ── */}
      <div className="rounded-2xl p-6 mb-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center"><User size={13} className="text-white" /></div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">Profile</h2>
        </div>
        <div className="flex items-center justify-between mb-6 p-4 rounded-xl" style={{ background: "var(--surface-low)" }}>
          <div className="flex items-center gap-4">
            {user?.photo ? (
              <img src={user.photo} alt={user.name} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
                {user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() ?? "??"}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-[#1a1c1c]">{profile.name}</p>
              <p className="text-xs text-[#48484a]">{profile.role} · {profile.email}</p>
            </div>
          </div>
          <button onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
            style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
            Sign out
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([{ label: "Full Name", key: "name", type: "text" }, { label: "Email", key: "email", type: "email" }] as const).map(({ label, key, type }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input type={type} value={profile[key]}
                onChange={e => setProfile({ ...profile, [key]: e.target.value })}
                className={inputClass} style={{ background: "var(--surface-low)" }}
                onFocus={e => (e.target.style.background = "var(--surface-lowest)")}
                onBlur={e => (e.target.style.background = "var(--surface-low)")} />
            </div>
          ))}
          <div>
            <label className={labelClass}>Role</label>
            <select value={profile.role} onChange={e => setProfile({ ...profile, role: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}>
              {["Agent", "Senior Agent", "Team Lead"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Timezone</label>
            <select value={profile.timezone} onChange={e => setProfile({ ...profile, timezone: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}>
              {["UTC-8", "UTC-5", "UTC+0", "UTC+1", "UTC+2", "UTC+3", "UTC+4", "UTC+5:30", "UTC+8"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Notifications ── */}
      <div className="rounded-2xl p-6 mb-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center"><Bell size={13} className="text-white" /></div>
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
              <div><p className="text-sm font-medium text-[#1a1c1c]">{label}</p><p className="text-xs text-[#48484a]">{sub}</p></div>
              <Toggle on={notifications[key]} onToggle={() => setNotifications(n => ({ ...n, [key]: !n[key] }))} />
            </div>
          ))}
        </div>
      </div>

      {/* ── CRM Settings ── */}
      <div className="rounded-2xl p-6 mb-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center"><Monitor size={13} className="text-white" /></div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">CRM Settings</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>CRM Name</label>
            <input value={crm.name} onChange={e => setCrm({ ...crm, name: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}
              onFocus={e => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={e => (e.target.style.background = "var(--surface-low)")} />
          </div>
          <div>
            <label className={labelClass}>SLA Target (minutes)</label>
            <input type="number" value={crm.slaTarget} onChange={e => setCrm({ ...crm, slaTarget: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}
              onFocus={e => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={e => (e.target.style.background = "var(--surface-low)")} />
          </div>
          <div>
            <label className={labelClass}>Head Office CRM Name</label>
            <input value={crm.headOfficeName} onChange={e => setCrm({ ...crm, headOfficeName: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}
              onFocus={e => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={e => (e.target.style.background = "var(--surface-low)")} />
          </div>
          <div>
            <label className={labelClass}>Default Assigned Agent</label>
            <select value={crm.defaultAgent} onChange={e => setCrm({ ...crm, defaultAgent: e.target.value })}
              className={inputClass} style={{ background: "var(--surface-low)" }}>
              {AGENTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Escalation Settings ── */}
      <div className="rounded-2xl p-6 mb-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <ArrowUpCircle size={13} className="text-amber-600" />
          </div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">Escalation Settings</h2>
        </div>
        <p className="text-xs text-[#48484a] mb-5">Configure automatic escalation rules for unresolved tickets.</p>

        {/* Auto-escalate toggle */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-4" style={{ background: "var(--surface-low)" }}>
          <div>
            <p className="text-sm font-medium text-[#1a1c1c]">Auto-Escalate</p>
            <p className="text-xs text-[#48484a]">Automatically escalate tickets past the threshold to Tier 2</p>
          </div>
          <Toggle
            on={escalationSettings.enabled}
            onToggle={() => setEscalationSettings(s => ({ ...s, enabled: !s.enabled }))}
          />
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity duration-200 ${escalationSettings.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div>
            <label className={labelClass}>Escalation Threshold</label>
            <select
              value={escalationSettings.thresholdHours}
              onChange={e => setEscalationSettings(s => ({ ...s, thresholdHours: Number(e.target.value) }))}
              className={inputClass} style={{ background: "var(--surface-low)" }}
            >
              {[1, 2, 4, 8, 24].map(h => (
                <option key={h} value={h}>{h === 24 ? "24 hours (1 day)" : `${h} hour${h > 1 ? "s" : ""}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tier 2 Agent</label>
            <select
              value={escalationSettings.tier2Agent}
              onChange={e => setEscalationSettings(s => ({ ...s, tier2Agent: e.target.value }))}
              className={inputClass} style={{ background: "var(--surface-low)" }}
            >
              {AGENTS.filter(a => a !== "Unassigned").map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Head Office CRM URL</label>
            <input
              type="url"
              placeholder="https://headoffice.example.com/tickets/{{ticket_id}}"
              value={escalationSettings.headOfficeUrl}
              onChange={e => setEscalationSettings(s => ({ ...s, headOfficeUrl: e.target.value }))}
              className={inputClass} style={{ background: "var(--surface-low)" }}
              onFocus={e => (e.target.style.background = "var(--surface-lowest)")}
              onBlur={e => (e.target.style.background = "var(--surface-low)")}
            />
            <p className="text-xs text-[#48484a] mt-1.5">Use <code className="px-1 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px]">{"{{ticket_id}}"}</code> as a placeholder — it will be replaced with the actual ticket ID when opening.</p>
          </div>
        </div>

        {/* Preview */}
        {escalationSettings.enabled && (
          <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-800"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px dashed rgba(245,158,11,0.35)" }}>
            <ArrowUpCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <span>
              Tickets open for more than <strong>{escalationSettings.thresholdHours}h</strong> will be automatically assigned to <strong>{escalationSettings.tier2Agent}</strong>.
            </span>
          </div>
        )}
      </div>

      {/* ── Canned Responses ── */}
      <div className="rounded-2xl p-6 mb-5" style={cardStyle}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <MessageSquare size={13} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-semibold text-[#1a1c1c]">Canned Responses</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-[#48484a]"
              style={{ background: "var(--surface-low)" }}>{cannedResponses.length}</span>
            {cannedSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check size={12} /> Saved
              </span>
            )}
          </div>
          <button onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white gradient-primary hover:opacity-90 transition-opacity">
            <Plus size={12} /> Add Template
          </button>
        </div>
        <p className="text-xs text-[#48484a] mb-5">Pre-written responses for common support scenarios. Use <code className="px-1 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px]">{"{{customer_name}}"}</code> and <code className="px-1 py-0.5 rounded bg-purple-50 text-purple-700 text-[11px]">{"{{ticket_id}}"}</code> as placeholders.</p>

        {/* New / Edit form */}
        {editingId !== null && (
          <div className="mb-4 p-4 rounded-2xl border-2 border-purple-200" style={{ background: "var(--surface-low)" }}>
            <p className="text-sm font-semibold text-[#1a1c1c] mb-4">{editingId === "new" ? "New Template" : "Edit Template"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelClass}>Title</label>
                <input
                  value={editDraft.title}
                  onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="e.g. Withdrawal Hold – KYC Required"
                  className={inputClass} style={{ background: "var(--surface-lowest)" }}
                />
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={editDraft.category}
                  onChange={e => setEditDraft(d => ({ ...d, category: e.target.value }))}
                  className={inputClass} style={{ background: "var(--surface-lowest)" }}
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className={labelClass}>Response Body</label>
              <textarea
                rows={5}
                value={editDraft.body}
                onChange={e => setEditDraft(d => ({ ...d, body: e.target.value }))}
                placeholder={"Hi {{customer_name}}, ..."}
                className={`${inputClass} resize-none leading-relaxed`}
                style={{ background: "var(--surface-lowest)" }}
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#48484a] hover:bg-[#f3f3f3] transition-colors">
                <X size={12} /> Cancel
              </button>
              <button
                onClick={saveCanned}
                disabled={!editDraft.title.trim() || !editDraft.body.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white gradient-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
                <Check size={12} /> Save Template
              </button>
            </div>
          </div>
        )}

        {/* Template list */}
        <div className="flex flex-col gap-2">
          {cannedResponses.length === 0 && (
            <div className="text-center py-10 text-sm text-[#48484a]">No templates yet. Click <strong>Add Template</strong> to get started.</div>
          )}
          {cannedResponses.map(cr => (
            <div key={cr.id}
              className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: "var(--surface-low)", border: editingId === cr.id ? "2px solid rgb(147,51,234)" : "2px solid transparent" }}>
              {/* Category pill + title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 flex-shrink-0">{cr.category}</span>
                  <span className="text-sm font-medium text-[#1a1c1c] truncate">{cr.title}</span>
                </div>
                <p className="text-xs text-[#48484a] line-clamp-2 leading-relaxed">{cr.body}</p>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(cr)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#48484a] hover:text-purple-600 hover:bg-purple-50 transition-colors">
                  <Pencil size={13} />
                </button>
                {deleteConfirm === cr.id ? (
                  <>
                    <button onClick={() => deleteCanned(cr.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setDeleteConfirm(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#48484a] hover:bg-[#f3f3f3] transition-colors">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => setDeleteConfirm(cr.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#48484a] hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Public Submission Form ── */}
      <div className="rounded-2xl p-6 mb-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
            <Link2 size={13} className="text-blue-600" />
          </div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">Public Submission Form</h2>
        </div>
        <p className="text-xs text-[#48484a] mb-5">
          Share this link with your customers so they can submit support tickets directly from your website — no login required.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-4 py-2.5 rounded-xl text-sm font-mono text-purple-700 select-all truncate"
            style={{ background: "rgba(113,49,214,0.06)", border: "1px solid rgba(113,49,214,0.15)" }}>
            {formUrl || "Loading…"}
          </div>
          <button onClick={copyUrl}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium flex-shrink-0 transition-all ${
              urlCopied ? "bg-emerald-500 text-white" : "gradient-primary text-white hover:opacity-90"
            }`}>
            {urlCopied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
          </button>
          <a href="/submit" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-[#48484a] hover:bg-[#f3f3f3] transition-colors flex-shrink-0"
            style={{ background: "var(--surface-low)" }}>
            <Link2 size={12} /> Preview
          </a>
        </div>
        <p className="text-xs text-[#48484a] mt-3">
          Tickets submitted via this form arrive in your queue tagged <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 uppercase tracking-wide mx-0.5">Web</span> so you can identify them at a glance.
        </p>
      </div>

      {/* ── About ── */}
      <div className="rounded-2xl p-6 mb-8" style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center"><Info size={13} className="text-white" /></div>
          <h2 className="text-base font-semibold text-[#1a1c1c]">About</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center"><Zap size={16} className="text-white" /></div>
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
