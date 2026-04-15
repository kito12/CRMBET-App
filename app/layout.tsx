import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ThemeProvider from "@/components/ThemeProvider";
import CommandPaletteProvider from "@/components/CommandPaletteProvider";
import DataProvider from "@/components/DataProvider";
import AuthProvider from "@/components/AuthProvider";
import SwRegister from "@/components/SwRegister";

export const viewport: Viewport = {
  width:            "device-width",
  initialScale:     1,
  maximumScale:     1,
  userScalable:     false,
  themeColor:       "#7131d6",
  viewportFit:      "cover",
};

export const metadata: Metadata = {
  title:       "DeskHive — Customer Support",
  description: "Customer relationship management for DeskHive support teams",
  manifest:    "/manifest.json",
  appleWebApp: {
    capable:         true,
    title:           "DeskHive",
    statusBarStyle:  "black-translucent",
  },
  icons: {
    icon:       [
      { url: "/pwa-icon/32",  sizes: "32x32",   type: "image/png" },
      { url: "/pwa-icon/192", sizes: "192x192",  type: "image/png" },
    ],
    apple:      [
      { url: "/pwa-icon/180", sizes: "180x180",  type: "image/png" },
    ],
    shortcut:   "/pwa-icon/32",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
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
          <AuthProvider>
            <DataProvider>
              <CommandPaletteProvider>
                <AppShell>{children}</AppShell>
              </CommandPaletteProvider>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
