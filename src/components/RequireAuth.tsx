"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/src/lib/firebase";
import type { UserProfile } from "@/src/lib/types";
import type { Household } from "@/src/lib/types";

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [householdLoading, setHouseholdLoading] = useState(true);

  const [error, setError] = useState<string>("");

  // 1) Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // 2) Profile subscription (self-read)
  useEffect(() => {
    setError("");
    setProfile(null);

    if (!user) {
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // If profile doc doesn't exist, your setup flow should create it.
          // But we stop "loading forever" and show a useful error.
          setProfile(null);
          setError(`Missing user profile doc: users/${user.uid}`);
        } else {
          const d = snap.data() as any;
          setProfile({
            uid: user.uid,
            email: d.email ?? user.email ?? null,
            name: d.name ?? "",
            householdId: d.householdId ?? null,
            createdAt: Number(d.createdAt ?? Date.now()),
            updatedAt: Number(d.updatedAt ?? Date.now()),
          });
        }
        setProfileLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to read user profile.");
        setProfileLoading(false);
      },
    );

    return () => unsub();
  }, [user?.uid]);

  // 3) Household subscription (ONLY if householdId exists)
  useEffect(() => {
    setError((e) => e); // keep existing error
    setHousehold(null);

    // If we don't have a profile yet, we're not ready to decide.
    if (!profile) {
      setHouseholdLoading(false);
      return;
    }

    //  if householdId is null, we MUST NOT stay "loading".
    if (!profile.householdId) {
      setHousehold(null);
      setHouseholdLoading(false);
      return;
    }

    setHouseholdLoading(true);

    const ref = doc(db, "households", profile.householdId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setHousehold(null);
          setError(`Household not found: households/${profile.householdId}`);
        } else {
          const d = snap.data() as any;
          setHousehold({
            id: snap.id,
            name: d.name ?? "Household",
            code: d.code ?? "",
            members: d.members ?? {},
            createdAt: Number(d.createdAt ?? Date.now()),
            updatedAt: Number(d.updatedAt ?? Date.now()),
          });
        }
        setHouseholdLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to read household.");
        setHouseholdLoading(false);
      },
    );

    return () => unsub();
  }, [profile?.householdId]);

  const loading = useMemo(
    () => authLoading || profileLoading || householdLoading,
    [authLoading, profileLoading, householdLoading],
  );

  // Redirect logic (in effects, not during render)
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    //  Allow /setup with no household or no name
    if (profile && (!profile.householdId || !profile.name?.trim()) && pathname !== "/setup") {
      router.replace("/setup");
      return;
    }
  }, [loading, user, profile, pathname, router]);

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontWeight: 600 }}>Something went wrong</p>
        <pre style={{ whiteSpace: "pre-wrap", opacity: 0.85 }}>{error}</pre>
      </div>
    );
  }

  // If logged out, redirect effect will run; show a small placeholder.
  if (!user) return <p style={{ padding: 24 }}>Redirecting…</p>;

  // - If no householdId or no name AND we're on /setup -> render children (setup page can show name + join form)
  // - If household exists and name is set -> render children
  if (profile && (!profile.householdId || !profile.name?.trim()) && pathname === "/setup") {
    return <>{children}</>;
  }

  // For all other routes, require household and name.
  if (profile && (!profile.householdId || !profile.name?.trim()))
    return <p style={{ padding: 24 }}>Redirecting…</p>;

  return <>{children}</>;
}
