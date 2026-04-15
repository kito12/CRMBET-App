"use client";

import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";
import CrmBetLogo from "@/components/ui/CrmBetLogo";

type BannerState = "hidden" | "android" | "ios";

// Detect iOS Safari (doesn't support beforeinstallprompt)
function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Already running as installed PWA
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
}

export default function PwaInstallBanner() {
  const [state,   setState]   = useState<BannerState>("hidden");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false); // controls CSS transition

  useEffect(() => {
    // Never show if already installed or user dismissed before
    if (isStandalone()) return;
    if (typeof localStorage !== "undefined" && localStorage.getItem("pwa-banner-dismissed")) return;

    // iOS — show manual instructions after 3 s
    if (isIos()) {
      const t = setTimeout(() => {
        setState("ios");
        setTimeout(() => setVisible(true), 50); // let DOM mount first
      }, 3000);
      return () => clearTimeout(t);
    }

    // Android / Chrome — wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setState("android");
      setTimeout(() => setVisible(true), 50);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    setTimeout(() => setState("hidden"), 350);
    try { localStorage.setItem("pwa-banner-dismissed", "1"); } catch { /* ignore */ }
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setTimeout(() => setState("hidden"), 350);
    }
    setDeferredPrompt(null);
  }

  if (state === "hidden") return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 transition-all duration-350"
      style={{
        opacity:    visible ? 1 : 0,
        transform:  `translateX(-50%) translateY(${visible ? "0" : "16px"})`,
      }}
    >
      <div
        className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
        style={{
          background:  "var(--surface-lowest)",
          boxShadow:   "0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(113,49,214,0.12)",
        }}
      >
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}
        >
          <CrmBetLogo size={16} className="text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--on-surface)" }}>
            Install DeskHive
          </p>
          {state === "android" ? (
            <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--on-surface-variant)" }}>
              Add to your home screen for quick access
            </p>
          ) : (
            <p className="text-[11px] mt-0.5 leading-tight flex items-center gap-1" style={{ color: "var(--on-surface-variant)" }}>
              Tap <Share size={10} className="inline" /> Share → &ldquo;Add to Home Screen&rdquo;
            </p>
          )}
        </div>

        {/* Android install button */}
        {state === "android" && (
          <button
            onClick={install}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}
          >
            <Download size={12} />
            Install
          </button>
        )}

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
          style={{ color: "var(--on-surface-variant)" }}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
