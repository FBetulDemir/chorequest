"use client";

import React, { useEffect, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import {
  ensureUserProfile,
  getUserProfile,
  updateUserProfile,
} from "@/src/lib/profile";
import {
  createHousehold,
  joinHouseholdByCode,
  getHousehold,
} from "@/src/lib/households";

export default function SetupPage() {
  return (
    <RequireAuth>
      <SetupInner />
    </RequireAuth>
  );
}

function SetupInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [household, setHousehold] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // form
  const [householdName, setHouseholdName] = useState("Our Household");
  const [code, setCode] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Ensure user doc exists
        await ensureUserProfile({ uid, email: user?.email ?? null });

        const p = await getUserProfile(uid);
        if (!alive) return;
        setProfile(p);

        if (p?.householdId) {
          const h = await getHousehold(p.householdId);
          if (!alive) return;
          setHousehold(h);
        } else {
          setHousehold(null);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load setup.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [uid, user?.email]);

  async function onCreateHousehold() {
    setError(null);
    try {
      const h = await createHousehold({ uid, name: householdName });
      await updateUserProfile(uid, { householdId: h.id });
      setHousehold(h);
      setProfile((prev: any) => ({ ...(prev ?? {}), householdId: h.id }));
    } catch (e: any) {
      setError(e?.message ?? "Failed to create household.");
    }
  }

  async function onJoinByCode() {
    setError(null);
    try {
      const h = await joinHouseholdByCode({ uid, code });
      await updateUserProfile(uid, { householdId: h.id });
      setHousehold(h);
      setProfile((prev: any) => ({ ...(prev ?? {}), householdId: h.id }));
    } catch (e: any) {
      setError(e?.message ?? "Failed to join household.");
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="cq-title">Household setup</div>

      {error ? (
        <div className="cq-card-soft p-3 text-sm text-red-600">{error}</div>
      ) : null}

      {profile?.householdId && household ? (
        <div className="cq-card p-5 space-y-2">
          <div className="font-semibold">Already connected</div>
          <div className="text-sm text-gray-600">
            Household: <span className="font-medium">{household.name}</span>
          </div>
          <div className="text-sm text-gray-600">
            Code:{" "}
            <span className="font-mono">{household.code ?? "(no code)"}</span>
          </div>
          <div className="text-xs text-gray-500">
            Share the code with your partner. They can join from /setup.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="cq-card p-5 space-y-3">
            <div className="font-semibold">Create household</div>
            <input
              className="cq-input"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Household name"
            />
            <button
              className="cq-btn-primary"
              type="button"
              onClick={onCreateHousehold}>
              Create household
            </button>
          </div>

          <div className="cq-card p-5 space-y-3">
            <div className="font-semibold">Join household</div>
            <input
              className="cq-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code (e.g. AB12CD)"
            />
            <button
              className="cq-btn"
              type="button"
              onClick={onJoinByCode}
              disabled={!code.trim()}>
              Join by code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
