"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useHousehold } from "@/src/components/HouseholdProvider";

function needsSetup(profile: { name: string; householdId: string | null } | null) {
  return !profile || !profile.householdId || !profile.name?.trim();
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[50vh] grid place-items-center p-6 text-center">
      <div>{children}</div>
    </div>
  );
}

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { uid, profile, household, loading, error } = useHousehold();

  const onSetup = pathname === "/setup";
  const setupIncomplete = needsSetup(profile) || (!!profile?.householdId && !household);

  // Redirects happen in an effect, never during render.
  useEffect(() => {
    if (loading) return;
    if (!uid) {
      // New visitors opening the app see the welcome tour; deep links go to sign-in
      router.replace(pathname === "/" ? "/welcome" : `/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!error && setupIncomplete && !onSetup) router.replace("/setup");
  }, [loading, uid, error, setupIncomplete, onSetup, pathname, router]);

  if (loading) {
    return (
      <CenteredMessage>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
        <p className="mt-3 text-sm text-gray-500">Loading your household…</p>
      </CenteredMessage>
    );
  }

  // The setup page handles a missing household itself.
  if (error && !onSetup) {
    return (
      <CenteredMessage>
        <div className="text-4xl">😕</div>
        <p className="mt-2 font-semibold text-gray-900">Something went wrong</p>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <button className="cq-btn mt-4" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </CenteredMessage>
    );
  }

  if (!uid) return <CenteredMessage><p className="text-sm text-gray-500">Redirecting…</p></CenteredMessage>;

  if (onSetup) return <>{children}</>;

  if (setupIncomplete) return <CenteredMessage><p className="text-sm text-gray-500">Redirecting…</p></CenteredMessage>;

  return <>{children}</>;
}
