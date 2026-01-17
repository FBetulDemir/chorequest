"use client";

import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    async function run() {
      if (loading) return;

      // not signed in -> login
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
        return;
      }

      // ensure profile exists, then check household
      setCheckingProfile(true);
      await ensureUserProfile({ uid: user.uid, email: user.email ?? null });
      const profile = await getUserProfile(user.uid);

      if (!profile?.householdId) {
        router.replace("/setup");
        return;
      }

      setCheckingProfile(false);
    }

    run();
  }, [loading, user, router, pathname]);

  if (loading || checkingProfile) return <div className="p-6">Loading...</div>;
  if (!user) return null;

  return <>{children}</>;
}
