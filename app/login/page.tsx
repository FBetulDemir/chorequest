"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/components/AuthProvider";

function LoginForm() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const nextPath = useMemo(() => params.get("next") || "/", [params]);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await signIn(email, password);
      else await signUp(email, password);

      router.replace(nextPath);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">ChoreQuest</h1>
          <button
            className="text-sm underline"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
            type="button">
            {mode === "login" ? "Create account" : "I have an account"}
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          {mode === "login"
            ? "Sign in to continue."
            : "Create an account to start."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            className="w-full rounded-lg border p-3"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="w-full rounded-lg border p-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
          />

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <button
            className="w-full rounded-lg bg-black p-3 text-white disabled:opacity-50"
            disabled={busy}
            type="submit">
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6"><div className="text-sm text-gray-500">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
