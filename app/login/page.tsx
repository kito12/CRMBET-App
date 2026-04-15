"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CrmBetLogo from "@/components/ui/CrmBetLogo";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { signInGoogle, user, loading, authError } = useAuth();
  const router = useRouter();
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Show Firebase auth errors (e.g. not invited)
  const displayError = authError || error;

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function handleGoogle() {
    setError("");
    setSubmitting(true);
    try {
      await signInGoogle();
      router.replace("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("popup-closed")) {
        setError("Sign-in cancelled. Please try again.");
      } else {
        setError("Sign-in failed. Make sure your account has been granted access.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
            <CrmBetLogo size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--on-surface)" }}>
            PremierBet
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--on-surface-variant)" }}>
            Sign in to your support account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7"
          style={{ background: "var(--surface-lowest)", boxShadow: "0 8px 40px rgba(26,28,28,0.1)" }}>

          <button
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--surface-low)", color: "var(--on-surface)", border: "1px solid rgba(148,163,184,0.2)" }}>
            {/* Google logo SVG */}
            {!submitting ? (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
            ) : (
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            )}
            {submitting ? "Signing in…" : "Continue with Google"}
          </button>

          {displayError && (
            <p className="text-xs text-red-500 text-center mt-3">{displayError}</p>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--on-surface-variant)" }}>
          Don&apos;t have access? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
