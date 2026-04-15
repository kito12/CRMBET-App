"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import CrmBetLogo from "@/components/ui/CrmBetLogo";

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #f8f7ff 0%, #f0f4ff 100%)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}
        >
          <CrmBetLogo size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold text-[#1a1c1c]">DeskHive</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
          <WifiOff size={28} className="text-slate-400" />
        </div>

        <h1 className="text-xl font-bold text-[#1a1c1c] mb-2">You&apos;re offline</h1>
        <p className="text-sm text-[#48484a] mb-8 leading-relaxed">
          No internet connection detected. Reconnect to continue using DeskHive.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(135deg, #7131d6, #0058bf)" }}
        >
          <RefreshCw size={15} />
          Try again
        </button>
      </div>

      <p className="text-xs text-[#9ca3af] mt-8">DeskHive Support</p>
    </div>
  );
}
