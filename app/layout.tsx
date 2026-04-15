import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ThemeProvider from "@/components/ThemeProvider";
import CommandPaletteProvider from "@/components/CommandPaletteProvider";

export const metadata: Metadata = {
  title: "BetCRM — Customer Support",
  description: "Customer relationship management for betting support teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('crm-theme');
            var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (t === 'dark' || (!t && d)) document.documentElement.classList.add('dark');
          } catch(e) {}
        `}} />
      </head>
      <body className="min-h-screen" style={{ background: "var(--surface)" }}>
        <ThemeProvider>
          <CommandPaletteProvider>
            <Sidebar />
            <main className="md:ml-16 min-h-screen p-4 md:p-8 pb-24 md:pb-8">
              {children}
            </main>
          </CommandPaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
