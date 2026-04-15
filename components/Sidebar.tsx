"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Ticket, Users, UserCircle, Settings, Zap,
  Moon, Sun, Search, MessageSquare, Bell, BarChart2, MoreHorizontal, X, ChevronRight, LogOut,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useCommandPalette } from "./CommandPaletteProvider";
import { useData } from "./DataProvider";
import { useAuth } from "./AuthProvider";
import NotificationPanel from "./NotificationPanel";

const navItems = [
  { href: "/",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/tickets",   icon: Ticket,          label: "Tickets" },
  { href: "/customers", icon: UserCircle,      label: "Customers" },
  { href: "/analytics", icon: BarChart2,       label: "Analytics" },
  { href: "/messages",  icon: MessageSquare,   label: "Messages" },
  { href: "/users",     icon: Users,           label: "Support Team" },
  { href: "/settings",  icon: Settings,        label: "Settings" },
];

// Items shown in the bottom bar on mobile
const mobileNavItems = [
  { href: "/",         icon: LayoutDashboard, label: "Dashboard" },
  { href: "/tickets",  icon: Ticket,          label: "Tickets" },
  { href: "/messages", icon: MessageSquare,   label: "Messages" },
];

// Items shown inside the "More" sheet
const moreItems = [
  { href: "/customers", icon: UserCircle, label: "Customers" },
  { href: "/analytics", icon: BarChart2,  label: "Analytics" },
  { href: "/users",     icon: Users,      label: "Support Team" },
  { href: "/settings",  icon: Settings,   label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { open: openPalette } = useCommandPalette();
  const { tickets, unreadCount } = useData();
  const { user, signOut } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen]   = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const openTicketCount = tickets.filter(t => t.status === "Open").length;

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-16 flex-col items-center py-6 gap-2 z-40"
        style={{ background: "var(--surface-lowest)", boxShadow: "2px 0 24px 0 rgba(26,28,28,0.04)" }}>

        {/* Logo */}
        <div className="mb-4 flex items-center justify-center w-9 h-9 rounded-xl gradient-primary">
          <Zap size={16} className="text-white" />
        </div>

        {/* Search / ⌘K */}
        <button onClick={openPalette} title="Search (⌘K)"
          className="relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 text-[#48484a] hover:bg-[#f3f3f3] mb-1">
          <Search size={16} />
          <span className="absolute left-14 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
            style={{ background: "#1a1c1c", color: "#fff" }}>Search ⌘K</span>
        </button>

        {/* Bell / notifications */}
        <button onClick={() => setNotifOpen(v => !v)} title="Notifications"
          className="relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 text-[#48484a] hover:bg-[#f3f3f3] mb-2">
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="absolute left-14 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
            style={{ background: "#1a1c1c", color: "#fff" }}>
            Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
          </span>
        </button>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active     = pathname === href || (href !== "/" && pathname.startsWith(href));
            const isTickets  = href === "/tickets";
            const isMessages = href === "/messages";
            return (
              <Link key={href} href={href} title={label}
                className={`relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200
                  ${active ? "gradient-primary text-white shadow-ambient" : "text-[#48484a] hover:bg-[#f3f3f3]"}`}>
                <Icon size={18} />
                {isTickets && openTicketCount > 0 && !active && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full gradient-primary text-white text-[9px] font-bold flex items-center justify-center">{openTicketCount}</span>
                )}
                {isMessages && !active && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center">2</span>
                )}
                <span className="absolute left-14 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
                  style={{ background: "#1a1c1c", color: "#fff" }}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <button onClick={toggle} title={theme === "dark" ? "Light mode" : "Dark mode"}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 text-[#48484a] hover:bg-[#f3f3f3]">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Avatar + sign out */}
        <div className="relative group">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}
            title={user?.name ?? "Account"}>
            {initials}
          </div>
          {/* Sign-out tooltip on hover */}
          <button
            onClick={signOut}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50"
            style={{ background: "#1a1c1c", color: "#fff" }}>
            <LogOut size={11} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav (5 items max) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
        style={{ background: "var(--surface-lowest)", borderTop: "1px solid rgba(148,163,184,0.12)" }}>

        {/* Core nav items */}
        {mobileNavItems.map(({ href, icon: Icon, label }) => {
          const active     = pathname === href || (href !== "/" && pathname.startsWith(href));
          const isTickets  = href === "/tickets";
          const isMessages = href === "/messages";
          return (
            <Link key={href} href={href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors duration-150 min-w-0
                ${active ? "text-purple-600" : "text-[#48484a]"}`}>
              <div className="relative">
                <Icon size={22} />
                {isTickets && openTicketCount > 0 && !active && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full gradient-primary text-white text-[9px] font-bold flex items-center justify-center">{openTicketCount}</span>
                )}
                {isMessages && !active && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center">2</span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-purple-600" : "text-[#48484a]"}`}>{label}</span>
            </Link>
          );
        })}

        {/* Bell */}
        <button onClick={() => setNotifOpen(v => !v)}
          className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[#48484a]">
          <div className="relative">
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">Alerts</span>
        </button>

        {/* More */}
        <button onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors duration-150
            ${moreItems.some(i => pathname.startsWith(i.href)) ? "text-purple-600" : "text-[#48484a]"}`}>
          <MoreHorizontal size={22} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* ── "More" slide-up sheet ── */}
      {/* Backdrop */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)} />
      )}

      {/* Sheet */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl transition-transform duration-300 ease-out
        ${moreOpen ? "translate-y-0" : "translate-y-full"}`}
        style={{ background: "var(--surface-lowest)", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>

        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}>
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>{user?.name ?? "Agent"}</p>
              <p className="text-xs" style={{ color: "var(--on-surface-variant)" }}>
                {user?.role === "admin" ? "Administrator" : "Support Agent"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={signOut}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ background: "var(--surface-low)", color: "var(--on-surface-variant)" }}
              title="Sign out">
              <LogOut size={14} />
            </button>
            <button onClick={() => setMoreOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              style={{ background: "var(--surface-low)", color: "var(--on-surface-variant)" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Theme toggle row */}
        <div className="mx-4 my-2 rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: "var(--surface-low)" }}>
          <div className="flex items-center gap-3" style={{ color: "var(--on-surface)" }}>
            {theme === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-purple-500" />}
            <span className="text-sm font-medium">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </div>
          {/* Toggle switch */}
          <button onClick={toggle}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{ backgroundColor: theme === "dark" ? "#7131d6" : "#cbd5e1" }}>
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-transform duration-200
                ${theme === "dark" ? "translate-x-5" : "translate-x-0.5"}`}
              style={{ backgroundColor: "#ffffff" }}
            />
          </button>
        </div>

        {/* More nav items */}
        <div className="mx-4 mb-4 mt-2 rounded-xl overflow-hidden" style={{ background: "var(--surface-low)" }}>
          {moreItems.map(({ href, icon: Icon, label }, i) => {
            const active = pathname === href || pathname.startsWith(href);
            return (
              <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors duration-150
                  ${i < moreItems.length - 1 ? "border-b" : ""}
                  ${active ? "text-purple-600" : ""}`}
                style={{
                  color: active ? undefined : "var(--on-surface)",
                  borderColor: "rgba(148,163,184,0.1)",
                }}>
                <Icon size={18} style={{ color: active ? undefined : "var(--on-surface-variant)" }} />
                <span className="text-sm font-medium flex-1">{label}</span>
                <ChevronRight size={15} style={{ color: "var(--on-surface-variant)" }} />
              </Link>
            );
          })}
        </div>

        {/* Safe area spacer */}
        <div className="h-6" />
      </div>

      {/* Notification panel */}
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
