"use client";

import React, { useState } from "react";

import { Spinner } from "@/src/components/ui/Button";
import { useIsClient } from "@/src/lib/useIsClient";
import {
  availableProviders,
  isCancelled,
  signInWithApple,
  signInWithGoogle,
  type SocialProvider,
} from "@/src/lib/socialAuth";
import { friendlyError } from "@/src/lib/errors";

function AppleLogo() {
  return (
    <svg viewBox="0 0 16 20" width="16" height="20" aria-hidden="true" fill="currentColor">
      <path d="M13.3 10.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8C3.4 5.1 1.9 6 1 7.5c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.3.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.3zM10.8 3.4c.7-.9 1.2-2 1-3.2-1 0-2.2.7-3 1.5-.6.7-1.2 1.9-1 3.1 1.1.1 2.3-.6 3-1.4z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/**
 * Apple / Google sign-in buttons, styled to each brand's guidelines.
 * Renders nothing when no provider is set up for this platform.
 */
export function SocialButtons({
  onSignedIn,
  onError,
}: {
  onSignedIn: () => void;
  onError: (message: string | null) => void;
}) {
  const isClient = useIsClient();
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  // Depends on the platform, so only decide in the browser
  const providers = isClient ? availableProviders() : [];
  if (!providers.length) return null;

  async function run(provider: SocialProvider) {
    setBusy(provider);
    onError(null);
    try {
      if (provider === "apple") await signInWithApple();
      else await signInWithGoogle();
      onSignedIn();
    } catch (e) {
      if (!isCancelled(e)) onError(friendlyError(e, "Sign-in didn't work. Please try again or use your email."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2.5">
      {providers.includes("apple") ? (
        <button
          type="button"
          onClick={() => run("apple")}
          disabled={!!busy}
          className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-black text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60 dark:bg-white dark:text-black">
          {busy === "apple" ? <Spinner /> : <AppleLogo />}
          Sign in with Apple
        </button>
      ) : null}
      {providers.includes("google") ? (
        <button
          type="button"
          onClick={() => run("google")}
          disabled={!!busy}
          className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-[#dadce0] bg-white text-[15px] font-semibold text-[#1f1f1f] transition active:scale-[0.98] disabled:opacity-60">
          {busy === "google" ? <Spinner /> : <GoogleLogo />}
          Continue with Google
        </button>
      ) : null}
      <div className="flex items-center gap-3 py-1 text-xs font-semibold text-faint">
        <div className="h-px flex-1 bg-gray-200" />
        or use email
        <div className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  );
}
