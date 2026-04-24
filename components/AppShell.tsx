"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import Sidebar from "./Sidebar";
import { useAuth } from "./AuthProvider";
import PwaInstallBanner from "./PwaInstallBanner";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/submit", "/brochure"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, loading } = useAuth();

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      router.replace("/login");
    }
  }, [user, loading, isPublic, router]);

  // Public pages — no sidebar, no auth needed
  if (isPublic) return <>{children}</>;

  // Auth loading — show centered spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center animate-pulse">
            <Zap size={18} className="text-white" />
          </div>
          <p className="text-sm" style={{ color: "var(--on-surface-variant)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  // Not authenticated — blank while redirect fires
  if (!user) return null;

  // Authenticated — render full app
  return (
    <>
      <Sidebar />
      <main key={pathname} className="page-enter md:ml-16 min-h-screen p-4 md:p-8 pb-24 md:pb-8"
        style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))" }}>
        {children}
      </main>
      <PwaInstallBanner />
    </>
  );
}
