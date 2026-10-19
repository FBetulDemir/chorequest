"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/src/components/AuthProvider";
import { friendlyError } from "@/src/lib/errors";
import { Mascot } from "@/src/components/ui/Mascot";

type Mode = "login" | "signup" | "reset";

const COPY: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  login: {
    title: "Welcome back 👋",
    subtitle: "Sign in to see today's quests.",
    submit: "Sign in",
  },
  signup: {
    title: "Create your account ✨",
    subtitle: "Share chores fairly and earn points together.",
    submit: "Create account",
  },
  reset: {
    title: "Reset your password",
    subtitle: "We'll email you a link to choose a new password.",
    submit: "Send reset link",
  },
};

function LoginForm() {
  const { signIn, signUp, resetPassword } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  // Only allow redirects within the app
  const nextPath = useMemo(() => {
    const next = params.get("next") || "/";
    return next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }, [params]);

  const [mode, setMode] = useState<Mode>(() => (params.get("mode") === "signup" ? "signup" : "login"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "reset") {
        await resetPassword(email.trim());
        setNotice(
          "If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).",
        );
        return;
      }

      if (mode === "login") await signIn(email.trim(), password);
      else await signUp(email.trim(), password);

      router.replace(nextPath);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const copy = COPY[mode];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center py-6">
      <div className="mb-3 w-full max-w-md">
        <Link href="/welcome" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </Link>
      </div>
      <div className="cq-card w-full max-w-md p-6 sm:p-8">
        <Mascot mood={mode === "signup" ? "celebrate" : "happy"} size={80} className="mx-auto text-ink" />

        <h1 className="mt-3 text-center text-2xl font-extrabold tracking-tight text-ink">
          {copy.title}
        </h1>
        <p className="mt-1 text-center text-sm text-muted">{copy.subtitle}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              className="cq-input"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {mode !== "reset" ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </label>
                {mode === "login" ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-purple-600 hover:underline"
                    onClick={() => switchMode("reset")}>
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <input
                  id="password"
                  className="cq-input pr-16"
                  placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "signup" ? 6 : undefined}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          <button className="cq-btn-primary w-full py-3" disabled={busy} type="submit">
            {busy ? "Please wait…" : copy.submit}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {mode === "login" ? (
            <>
              New to ChoreQuest?{" "}
              <button type="button" className="font-semibold text-purple-600 hover:underline" onClick={() => switchMode("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              {mode === "signup" ? "Already have an account? " : "Remembered it? "}
              <button type="button" className="font-semibold text-purple-600 hover:underline" onClick={() => switchMode("login")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <div className="text-sm text-gray-500">Loading…</div>
        </div>
      }>
      <LoginForm />
    </Suspense>
  );
}
