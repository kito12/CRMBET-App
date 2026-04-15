"use client";

import { useState } from "react";
import { Zap, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const ISSUE_TYPES = [
  "Withdrawal Issue",
  "Bet Settlement",
  "Account Access",
  "Bonus Dispute",
  "Live Betting",
  "Other",
];

const emptyForm = {
  name: "",
  clientId: "",
  email: "",
  phone: "",
  issue: "Withdrawal Issue",
  description: "",
};

function nowLabel() {
  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[now.getMonth()]} ${now.getDate()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
}

export default function SubmitPage() {
  const [form, setForm]           = useState(emptyForm);
  const [errors, setErrors]       = useState<Partial<typeof emptyForm>>({});
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [submitError, setSubmitError] = useState("");

  function validate() {
    const e: Partial<typeof emptyForm> = {};
    if (!form.name.trim())        e.name = "Please enter your name";
    if (!form.email.trim() && !form.phone.trim())
      e.email = "Please provide at least an email or phone number";
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Please enter a valid email address";
    if (!form.description.trim()) e.description = "Please describe your issue";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setSubmitError("");

    try {
      // Generate a unique ticket ID using timestamp
      const newId = `TKT-${Date.now()}`;

      await setDoc(doc(db, "tickets", newId), {
        id:          newId,
        clientId:    form.clientId.trim() || "—",
        customer:    form.name.trim(),
        email:       form.email.trim(),
        phone:       form.phone.trim(),
        issue:       form.issue,
        priority:    "Medium",
        status:      "Open",
        agent:       "Unassigned",
        created:     nowLabel(),
        description: form.description.trim(),
        source:      "web_form",
      });

      setTicketId(newId);
      setSubmitted(true);
    } catch (err) {
      console.error("Submit failed:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(emptyForm);
    setErrors({});
    setSubmitted(false);
    setTicketId("");
    setSubmitError("");
  }

  const inputBase = "w-full px-4 py-3 rounded-xl text-sm text-[#1a1c1c] outline-none focus:ring-2 focus:ring-purple-300 transition-all bg-white border border-[rgba(204,195,215,0.4)] placeholder:text-[#9ca3af]";

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
        style={{ background: "linear-gradient(135deg, #f8f7ff 0%, #f0f4ff 100%)" }}>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1c1c] mb-2">Ticket Submitted!</h1>
          <p className="text-sm text-[#48484a] mb-6">
            Your request has been received. Our support team will be in touch soon.
          </p>
          <div className="px-5 py-3.5 rounded-2xl mb-8" style={{ background: "rgba(113,49,214,0.06)" }}>
            <p className="text-xs text-[#48484a] mb-1">Your reference number</p>
            <p className="text-lg font-bold text-purple-700 tracking-wide font-mono">{ticketId}</p>
            <p className="text-xs text-[#48484a] mt-1">Save this for future correspondence</p>
          </div>
          <button onClick={handleReset}
            className="w-full py-3 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}>
            Submit Another Request
          </button>
        </div>
        <p className="text-xs text-[#9ca3af] mt-8">Powered by BetCRM</p>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, #f8f7ff 0%, #f0f4ff 100%)" }}>

      {/* Brand header */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}>
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold text-[#1a1c1c]">BetCRM</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Support</span>
      </div>

      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Card header */}
        <div className="px-8 py-7" style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}>
          <h1 className="text-xl font-bold text-white mb-1">Submit a Support Request</h1>
          <p className="text-sm text-purple-200">We&apos;ll get back to you as soon as possible</p>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="px-8 py-7 flex flex-col gap-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[#48484a] uppercase tracking-wide mb-1.5">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="John Smith"
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: undefined })); }}
              className={`${inputBase} ${errors.name ? "border-red-300 focus:ring-red-200" : ""}`}
            />
            {errors.name && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5"><AlertCircle size={11} />{errors.name}</p>
            )}
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-xs font-semibold text-[#48484a] uppercase tracking-wide mb-1.5">
              Client ID <span className="text-[#9ca3af] font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="CLT-10042"
              value={form.clientId}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              className={inputBase}
            />
            <p className="text-xs text-[#9ca3af] mt-1.5">Found on your welcome email or account profile page</p>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#48484a] uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={form.email}
                onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: undefined })); }}
                className={`${inputBase} ${errors.email ? "border-red-300 focus:ring-red-200" : ""}`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#48484a] uppercase tracking-wide mb-1.5">Phone</label>
              <input
                type="tel"
                placeholder="+1 555 000 0000"
                value={form.phone}
                onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, email: undefined })); }}
                className={inputBase}
              />
            </div>
          </div>
          {errors.email && (
            <p className="flex items-center gap-1 text-xs text-red-500 -mt-2"><AlertCircle size={11} />{errors.email}</p>
          )}
          <p className="text-xs text-[#9ca3af] -mt-3">At least one contact method required</p>

          {/* Issue type */}
          <div>
            <label className="block text-xs font-semibold text-[#48484a] uppercase tracking-wide mb-1.5">
              Issue Type <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={form.issue}
                onChange={e => setForm(f => ({ ...f, issue: e.target.value }))}
                className={`${inputBase} appearance-none pr-10 cursor-pointer`}
              >
                {ISSUE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#48484a] uppercase tracking-wide mb-1.5">
              Describe Your Issue <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Please provide as much detail as possible — account number, bet ID, transaction reference, etc."
              value={form.description}
              onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(er => ({ ...er, description: undefined })); }}
              className={`${inputBase} resize-none leading-relaxed ${errors.description ? "border-red-300 focus:ring-red-200" : ""}`}
            />
            {errors.description && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5"><AlertCircle size={11} />{errors.description}</p>
            )}
          </div>

          {submitError && (
            <p className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 px-3 py-2.5 rounded-xl">
              <AlertCircle size={13} />{submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}
          >
            {loading ? "Submitting…" : "Submit Request"}
          </button>

          <p className="text-xs text-center text-[#9ca3af]">
            By submitting you agree to our support terms. Your reference number will be shown on the next screen.
          </p>
        </form>
      </div>

      <p className="text-xs text-[#9ca3af] mt-8">Powered by BetCRM</p>
    </div>
  );
}
