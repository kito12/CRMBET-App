"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Ticket, Users, UserCircle, Settings, Zap, Moon, Sun, Search, MessageSquare,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useCommandPalette } from "./CommandPaletteProvider";
import { tickets } from "@/lib/data";

const navItems = [
  { href: "/",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/tickets",   icon: Ticket,          label: "Tickets" },
  { href: "/customers", icon: UserCircle,       label: "Customers" },
  { href: "/messages",  icon: MessageSquare,   label: "Messages" },
  { href: "/users",     icon: Users,           label: "Support Team" },
  { href: "/settings",  icon: Settings,        label: "Settings" },
];

const openTicketCount = tickets.filter(t => t.status === "Open").length;

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { open: openPalette } = useCommandPalette();

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
          className="relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 text-[#48484a] hover:bg-[#f3f3f3] mb-2">
          <Search size={16} />
          <span className="absolute left-14 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
            style={{ background: "#1a1c1c", color: "#fff" }}>Search ⌘K</span>
        </button>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            const isTickets = href === "/tickets";
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

        <button onClick={toggle} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 text-[#48484a] hover:bg-[#f3f3f3]">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}>JD</div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-1 py-2"
        style={{ background: "var(--surface-lowest)", borderTop: "1px solid rgba(204,195,215,0.15)" }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          const isTickets = href === "/tickets";
          const isMessages = href === "/messages";
          return (
            <Link key={href} href={href}
              className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-0
                ${active ? "text-purple-600" : "text-[#48484a]"}`}>
              <div className="relative">
                <Icon size={20} />
                {isTickets && openTicketCount > 0 && !active && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full gradient-primary text-white text-[8px] font-bold flex items-center justify-center">{openTicketCount}</span>
                )}
                {isMessages && !active && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-pink-500 text-white text-[8px] font-bold flex items-center justify-center">2</span>
                )}
              </div>
              <span className={`text-[10px] font-medium truncate ${active ? "text-purple-600" : "text-[#48484a]"}`}>
                {label === "Support Team" ? "Team" : label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
