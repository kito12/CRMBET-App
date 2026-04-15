"use client";

import { useState, useEffect } from "react";
import { Search, UserCircle, Plus, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import type { Customer, AccountType, CustomerStatus } from "@/lib/data";
import { useData } from "@/components/DataProvider";
import { SkeletonCard, SkeletonTableRow } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import { InputField, SelectField } from "@/components/ui/FormField";

const accountTypePill: Record<string, string> = {
  VIP:      "bg-purple-50 text-purple-700",
  Premium:  "bg-blue-50 text-blue-700",
  Standard: "bg-slate-100 text-slate-600",
};

const statusDot: Record<string, string> = {
  Active:    "bg-emerald-400",
  Suspended: "bg-red-400",
  Inactive:  "bg-slate-300",
};

const ITEMS_PER_PAGE = 8;

const defaultForm = {
  clientId: "", name: "", email: "", phone: "", country: "",
  accountType: "Standard" as AccountType,
  status: "Active" as CustomerStatus,
};

export default function CustomersPage() {
  const { customers, setCustomers, tickets, hydrated } = useData();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [clientIdError, setClientIdError] = useState("");

  useEffect(() => { setPage(1); }, [search]);

  function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    const trimmedId = form.clientId.trim().toUpperCase();
    if (customers.some(c => c.clientId === trimmedId)) {
      setClientIdError("This Client ID already exists.");
      return;
    }
    const newCustomer: Customer = {
      clientId: trimmedId,
      name: form.name,
      email: form.email,
      phone: form.phone,
      country: form.country,
      accountType: form.accountType,
      status: form.status,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    setCustomers(prev => [newCustomer, ...prev]);
    setAddOpen(false);
    setForm(defaultForm);
    setClientIdError("");
  }

  function exportCSV() {
    const headers = ["Client ID","Name","Email","Phone","Country","Account Type","Status","Created"];
    const rows = customers.map(c => [c.clientId, c.name, c.email, c.phone, c.country, c.accountType, c.status, c.createdAt]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ""}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "customers.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.clientId.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-label-caps text-[#48484a] mb-1">CRM</p>
          <h1 className="text-display text-[#1a1c1c]">Customers</h1>
          <p className="text-sm text-[#48484a] mt-1">All registered client accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#48484a] hover:bg-[#f3f3f3] transition-colors"
            style={{ background: "var(--surface-lowest)", border: "1px solid rgba(204,195,215,0.3)" }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setAddOpen(true)} className="gradient-primary text-white text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity shadow-ambient">
            <Plus size={15} /> Add Customer
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {!hydrated ? (
          [1,2,3,4].map(i => <SkeletonCard key={i} />)
        ) : [
          { label: "TOTAL CLIENTS", value: customers.length,                                      sub: "all time",           color: "text-purple-600",  bg: "bg-purple-50",  href: null },
          { label: "ACTIVE",        value: customers.filter(c => c.status === "Active").length,   sub: "currently active",   color: "text-emerald-600", bg: "bg-emerald-50", href: null },
          { label: "VIP ACCOUNTS",  value: customers.filter(c => c.accountType === "VIP").length, sub: "high-value clients", color: "text-blue-600",    bg: "bg-blue-50",    href: null },
          { label: "OPEN TICKETS",  value: tickets.filter(t => t.status === "Open").length,       sub: "across all clients", color: "text-amber-600",   bg: "bg-amber-50",   href: "/tickets?status=Open" },
        ].map(({ label, value, sub, color, bg, href }) => {
          const inner = (
            <>
              <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
                <UserCircle size={16} className={color} />
              </div>
              <p className="text-label-caps text-[#48484a] mb-1">{label}</p>
              <p className="text-2xl font-bold text-[#1a1c1c] tracking-tight">{value}</p>
              <p className="text-xs text-[#48484a] mt-1">{sub}</p>
            </>
          );
          return href ? (
            <Link key={label} href={href} className="rounded-2xl p-5 transition-all duration-150 hover:scale-[1.02] hover:shadow-md" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>{inner}</Link>
          ) : (
            <div key={label} className="rounded-2xl p-5" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>{inner}</div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-xs mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#48484a]" />
        <input
          type="text"
          placeholder="Search by name, ID or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] placeholder:text-[#48484a] outline-none focus:ring-2 focus:ring-purple-200 transition-all"
          style={{ background: "var(--surface-low)" }}
          onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
          onBlur={(e) => (e.target.style.background = "var(--surface-low)")}
        />
      </div>

      {/* Mobile card list */}
      <div className="flex md:hidden flex-col gap-2 mb-4">
        {paginated.length === 0 ? (
          <p className="text-center text-sm text-[#48484a] py-12">No customers found.</p>
        ) : paginated.map((customer) => {
          const clientTickets = tickets.filter(t => t.clientId === customer.clientId);
          const openCount = clientTickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
          return (
            <Link key={customer.clientId} href={`/customers/${customer.clientId}`}
              className="flex items-center gap-3 p-4 rounded-2xl transition-all"
              style={{ background: "var(--surface-lowest)", boxShadow: "0 2px 12px 0 rgba(26,28,28,0.06)" }}>
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {customer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-[#1a1c1c] truncate">{customer.name}</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${accountTypePill[customer.accountType]}`}>
                    {customer.accountType}
                  </span>
                </div>
                <p className="text-xs text-[#48484a] truncate">{customer.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDot[customer.status]}`} />
                  <span className="text-xs text-[#48484a]">{customer.status}</span>
                  <span className="text-xs text-[#48484a]">· {clientTickets.length} ticket{clientTickets.length !== 1 ? "s" : ""}</span>
                  {openCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{openCount} open</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl overflow-hidden" style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px 0 rgba(26,28,28,0.06)" }}>
        {/* Header */}
        <div className="grid grid-cols-[1fr_1.6fr_1.4fr_1.1fr_0.9fr_0.8fr_0.7fr] gap-4 px-6 py-3" style={{ background: "var(--surface-low)" }}>
          {["CLIENT ID", "CUSTOMER", "EMAIL", "PHONE", "ACCOUNT", "STATUS", "TICKETS"].map((h) => (
            <span key={h} className="text-label-caps text-[#48484a]">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="flex flex-col p-3 gap-1">
          {!hydrated ? (
            [1,2,3,4,5,6,7,8].map(i => <SkeletonTableRow key={i} cols={7} />)
          ) : paginated.length === 0 ? (
            <div className="py-16 text-center text-[#48484a] text-sm">No customers found.</div>
          ) : (
            paginated.map((customer) => {
              const clientTickets = tickets.filter(t => t.clientId === customer.clientId);
              const openCount = clientTickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
              return (
                <Link
                  key={customer.clientId}
                  href={`/customers/${customer.clientId}`}
                  className="grid grid-cols-[1fr_1.6fr_1.4fr_1.1fr_0.9fr_0.8fr_0.7fr] gap-4 items-center px-3 py-3.5 rounded-xl transition-all duration-150"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-low)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="text-sm font-medium text-purple-600">{customer.clientId}</span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {customer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1a1c1c]">{customer.name}</p>
                      <p className="text-xs text-[#48484a]">{customer.country}</p>
                    </div>
                  </div>
                  <span className="text-sm text-[#48484a] truncate">{customer.email}</span>
                  <span className="text-xs text-[#48484a] whitespace-nowrap">{customer.phone}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${accountTypePill[customer.accountType]}`}>
                    {customer.accountType}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot[customer.status]}`} />
                    <span className="text-xs text-[#48484a]">{customer.status}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-[#1a1c1c]">{clientTickets.length}</span>
                    {openCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{openCount} open</span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: "1px solid rgba(204,195,215,0.15)", background: "var(--surface-low)" }}>
          <span className="text-xs text-[#48484a]">
            Showing {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} customers
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#48484a] transition-colors disabled:opacity-30 hover:bg-white">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${page === p ? "gradient-primary text-white" : "text-[#48484a] hover:bg-white"}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#48484a] transition-colors disabled:opacity-30 hover:bg-white">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setClientIdError(""); setForm(defaultForm); }} title="Add Customer" subtitle="Create a new client account">
        <form onSubmit={handleAddCustomer} className="flex flex-col gap-4">
          {/* Client ID — manually entered from the betting platform */}
          <div>
            <InputField
              label="Client ID"
              placeholder="e.g. CLT-1042"
              value={form.clientId}
              onChange={(e) => { setForm({ ...form, clientId: e.target.value }); setClientIdError(""); }}
              required
            />
            {clientIdError && (
              <p className="text-xs text-red-500 mt-1">{clientIdError}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Full Name" placeholder="John Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <InputField label="Email" type="email" placeholder="john@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Phone Number" type="tel" placeholder="+1 555 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            <InputField label="Country" placeholder="United States" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Account Type" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value as AccountType })}>
              {(["Standard", "Premium", "VIP"] as AccountType[]).map(t => <option key={t}>{t}</option>)}
            </SelectField>
            <SelectField label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}>
              {(["Active", "Suspended", "Inactive"] as CustomerStatus[]).map(s => <option key={s}>{s}</option>)}
            </SelectField>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAddOpen(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#48484a]"
              style={{ background: "var(--surface-low)" }}>Cancel</button>
            <button type="submit" disabled={!form.clientId.trim() || !form.name || !form.email || !form.phone || !form.country}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
              Create Customer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
