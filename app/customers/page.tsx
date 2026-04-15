"use client";

import { useState, useEffect, useDeferredValue, useMemo } from "react";
import { Search, UserCircle, Plus, ChevronLeft, ChevronRight, Download, Upload, AlertTriangle, CheckCircle2, Crown, FileText, X } from "lucide-react";
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

interface ParsedRow {
  clientId: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  accountType: AccountType;
  status: CustomerStatus;
  isDuplicate: boolean;
  errors: string[];
}

// Normalise a CSV header string to a known key
function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const HEADER_MAP: Record<string, keyof Omit<ParsedRow, "isDuplicate" | "errors">> = {
  clientid:    "clientId",  "client id": "clientId",   id: "clientId",
  name:        "name",      fullname:    "name",        "full name": "name",
  email:       "email",
  phone:       "phone",     mobile:      "phone",       phonenumber: "phone",
  country:     "country",
  accounttype: "accountType", "account type": "accountType", type: "accountType",
  status:      "status",
};

function parseCSVFile(text: string, existingIds: Set<string>, existingEmails: Set<string>): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse a single CSV line respecting quoted fields
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim()); cur = "";
      } else cur += ch;
    }
    fields.push(cur.trim());
    return fields;
  }

  const rawHeaders = parseLine(lines[0]).map(normaliseHeader);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const raw: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      const mapped = HEADER_MAP[h];
      if (mapped) raw[mapped] = vals[idx]?.trim() ?? "";
    });

    const errors: string[] = [];
    if (!raw.name)  errors.push("Name required");
    if (!raw.email) errors.push("Email required");

    // Normalise accountType
    let acct: AccountType = "VIP";
    const rawAcct = (raw.accountType ?? "").toLowerCase();
    if (rawAcct === "premium") acct = "Premium";
    else if (rawAcct === "standard") acct = "Standard";

    // Normalise status
    let stat: CustomerStatus = "Active";
    const rawStat = (raw.status ?? "").toLowerCase();
    if (rawStat === "suspended") stat = "Suspended";
    else if (rawStat === "inactive") stat = "Inactive";

    const clientId = raw.clientId
      ? raw.clientId.toUpperCase()
      : `CLT-${Date.now()}-${i}`;

    const isDuplicate =
      existingIds.has(clientId) ||
      (!!raw.email && existingEmails.has(raw.email.toLowerCase()));

    rows.push({
      clientId,
      name: raw.name ?? "",
      email: raw.email ?? "",
      phone: raw.phone ?? "",
      country: raw.country ?? "",
      accountType: acct,
      status: stat,
      isDuplicate,
      errors,
    });
  }
  return rows;
}

export default function CustomersPage() {
  const { customers, setCustomers, tickets, hydrated } = useData();
  const [searchInput, setSearchInput] = useState("");
  const search = useDeferredValue(searchInput);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [clientIdError, setClientIdError] = useState("");

  // CSV Import state
  const [importOpen, setImportOpen]     = useState(false);
  const [importRows, setImportRows]     = useState<ParsedRow[]>([]);
  const [importDone, setImportDone]     = useState(false);
  const [importCount, setImportCount]   = useState(0);
  const [dragOver, setDragOver]         = useState(false);

  useEffect(() => { setPage(1); }, [searchInput]);

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

  function downloadTemplate() {
    const csv = `Client ID,Name,Email,Phone,Country,Account Type,Status\nCLT-1001,John Smith,john@example.com,+1 555 000 0001,United States,VIP,Active\nCLT-1002,Maria Garcia,maria@example.com,+34 600 000 002,Spain,VIP,Active`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "vip_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const existingIds    = new Set(customers.map(c => c.clientId));
      const existingEmails = new Set(customers.map(c => c.email.toLowerCase()));
      const rows = parseCSVFile(text, existingIds, existingEmails);
      setImportRows(rows);
      setImportDone(false);
    };
    reader.readAsText(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) processFile(file);
  }

  function handleConfirmImport() {
    const toImport = importRows.filter(r => !r.isDuplicate && r.errors.length === 0);
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const newCustomers: Customer[] = toImport.map(r => ({
      clientId:    r.clientId,
      name:        r.name,
      email:       r.email,
      phone:       r.phone,
      country:     r.country,
      accountType: r.accountType,
      status:      r.status,
      createdAt:   now,
    }));
    setCustomers(prev => [...newCustomers, ...prev]);
    setImportCount(toImport.length);
    setImportDone(true);
  }

  function closeImport() {
    setImportOpen(false);
    setImportRows([]);
    setImportDone(false);
    setImportCount(0);
  }

  const filtered = useMemo(() => customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.clientId.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  ), [customers, search]);

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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#48484a] hover:bg-[#f3f3f3] transition-colors"
            style={{ background: "var(--surface-lowest)", border: "1px solid rgba(204,195,215,0.3)" }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => { setImportOpen(true); setImportRows([]); setImportDone(false); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors"
            style={{ background: "rgba(237,233,254,0.6)", border: "1px solid rgba(147,51,234,0.2)" }}>
            <Crown size={14} /> Import VIPs
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
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

      {/* ── CSV Import Modal ── */}
      <Modal open={importOpen} onClose={closeImport} title="Import VIPs" subtitle="Bulk import customers from a CSV file">
        {importDone ? (
          // ── Success state ──
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#1a1c1c]">{importCount} customer{importCount !== 1 ? "s" : ""} imported</p>
              <p className="text-sm text-[#48484a] mt-1">They've been added to your customer list.</p>
            </div>
            <button onClick={closeImport}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : importRows.length === 0 ? (
          // ── Upload state ──
          <div className="flex flex-col gap-4">
            {/* Drag & drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all ${dragOver ? "border-purple-400 bg-purple-50" : "border-slate-200"}`}
              style={{ background: dragOver ? "rgba(237,233,254,0.4)" : "var(--surface-low)" }}>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                <Upload size={20} className="text-purple-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#1a1c1c]">Drop your CSV here</p>
                <p className="text-xs text-[#48484a] mt-0.5">or click to browse</p>
              </div>
              <label className="px-4 py-2 rounded-xl text-xs font-medium text-purple-700 cursor-pointer hover:bg-purple-100 transition-colors"
                style={{ background: "rgba(237,233,254,0.8)" }}>
                Browse file
                <input type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
              </label>
            </div>

            {/* Template download */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--surface-low)" }}>
              <div className="flex items-center gap-2.5">
                <FileText size={14} className="text-[#48484a]" />
                <div>
                  <p className="text-xs font-semibold text-[#1a1c1c]">Need a template?</p>
                  <p className="text-xs text-[#48484a]">Columns: Client ID, Name, Email, Phone, Country, Account Type, Status</p>
                </div>
              </div>
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors flex-shrink-0"
                style={{ background: "rgba(237,233,254,0.6)" }}>
                <Download size={11} /> Template
              </button>
            </div>

            {/* Column format hint */}
            <p className="text-xs text-[#48484a] text-center">
              Account Type defaults to <span className="font-semibold text-purple-600">VIP</span> if not specified · Duplicates are skipped automatically
            </p>
          </div>
        ) : (
          // ── Preview state ──
          (() => {
            const valid      = importRows.filter(r => !r.isDuplicate && r.errors.length === 0);
            const duplicates = importRows.filter(r => r.isDuplicate);
            const errors     = importRows.filter(r => !r.isDuplicate && r.errors.length > 0);
            return (
              <div className="flex flex-col gap-4">
                {/* Summary chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700">
                    <CheckCircle2 size={12} /> {valid.length} will be imported
                  </span>
                  {duplicates.length > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700">
                      <X size={12} /> {duplicates.length} duplicate{duplicates.length !== 1 ? "s" : ""} — skipped
                    </span>
                  )}
                  {errors.length > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-700">
                      <AlertTriangle size={12} /> {errors.length} error{errors.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <button onClick={() => setImportRows([])} className="ml-auto text-xs text-[#48484a] hover:text-red-500 transition-colors flex items-center gap-1">
                    <Upload size={11} /> New file
                  </button>
                </div>

                {/* Preview table */}
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: "rgba(204,195,215,0.2)" }}>
                  <div className="grid grid-cols-[1fr_1.2fr_1.4fr_0.9fr_80px] gap-2 px-3 py-2 text-label-caps text-[#48484a]"
                    style={{ background: "var(--surface-low)" }}>
                    {["CLIENT ID", "NAME", "EMAIL", "TYPE", "STATUS"].map(h => <span key={h}>{h}</span>)}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {importRows.map((row, i) => {
                      const rowBg =
                        row.errors.length > 0 ? "rgba(254,226,226,0.5)" :
                        row.isDuplicate       ? "rgba(255,251,235,0.5)" :
                        "transparent";
                      return (
                        <div key={i}
                          className="grid grid-cols-[1fr_1.2fr_1.4fr_0.9fr_80px] gap-2 px-3 py-2.5 items-center border-t text-xs"
                          style={{ background: rowBg, borderColor: "rgba(204,195,215,0.1)" }}>
                          <span className="font-medium text-purple-600 truncate">{row.clientId}</span>
                          <span className="truncate text-[#1a1c1c]">{row.name || <span className="text-red-400 italic">missing</span>}</span>
                          <span className="truncate text-[#48484a]">{row.email || <span className="text-red-400 italic">missing</span>}</span>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold w-fit ${
                            row.accountType === "VIP" ? "bg-purple-50 text-purple-700" :
                            row.accountType === "Premium" ? "bg-blue-50 text-blue-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {row.accountType === "VIP" && <Crown size={7} />} {row.accountType}
                          </span>
                          <span>
                            {row.errors.length > 0 ? (
                              <span className="text-red-500 font-medium" title={row.errors.join(", ")}>Error</span>
                            ) : row.isDuplicate ? (
                              <span className="text-amber-600 font-medium">Duplicate</span>
                            ) : (
                              <span className="text-emerald-600 font-medium">Ready</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button onClick={closeImport}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[#48484a]"
                    style={{ background: "var(--surface-low)" }}>Cancel</button>
                  <button onClick={handleConfirmImport} disabled={valid.length === 0}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                    Import {valid.length} Customer{valid.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            );
          })()
        )}
      </Modal>

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
