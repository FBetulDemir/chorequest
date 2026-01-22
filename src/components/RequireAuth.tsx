"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/components/AuthProvider";
import { ensureUserProfile, getUserProfile } from "@/src/lib/profile";

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [checkingProfile, setCheckingProfile] = useState(true);
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;

    async function run() {
      if (loading) return;

      // not signed in -> login
      if (!user) {
        setCheckingProfile(false);
        router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
        return;
      }

      setCheckingProfile(true);

      try {
        await ensureUserProfile({ uid: user.uid, email: user.email ?? null });
        const profile = await getUserProfile(user.uid);

        // ignore if a newer run started
        if (runId.current !== id) return;

        if (!profile?.householdId) {
          router.replace("/setup");
          return;
        }

        setCheckingProfile(false);
      } catch {
        // if something fails, send to setup as safe fallback
        if (runId.current !== id) return;
        router.replace("/setup");
      }
    }

    run();
  }, [loading, user, router, pathname]);

  if (loading || checkingProfile) return <div className="p-6">Loading...</div>;
  if (!user) return null;

  return <>{children}</>;
}
