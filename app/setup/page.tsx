"use client";

import React, { useState } from "react";
import { useAuth } from "@/src/components/AuthProvider";
import { createHousehold, joinHouseholdByCode } from "@/src/lib/households";
import { updateUserProfile } from "@/src/lib/profile";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"create" | "join">("create");
  const [yourName, setYourName] = useState("");
  const [householdName, setHouseholdName] = useState("ChoreQuest Home");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <div className="p-6">Please sign in first.</div>;

  const uid = user.uid;

  async function onCreate() {
    setError(null);
    setBusy(true);
    try {
      const hh = await createHousehold({ uid, name: householdName });
      await updateUserProfile(uid, {
        name: yourName.trim() || "Me",
        householdId: hh.id,
      });
      alert(`Household created! Share this code with your partner: ${hh.code}`);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create household");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    setError(null);
    setBusy(true);
    try {
      const hh = await joinHouseholdByCode({ uid, code });
      await updateUserProfile(uid, {
        name: yourName.trim() || "Partner",
        householdId: hh.id,
      });
      router.replace("/");
    } catch (e: any) {
      setError(e?.message ?? "Failed to join household");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Setup</h1>
          <button
            className="text-sm underline"
            onClick={() => setMode(mode === "create" ? "join" : "create")}>
            {mode === "create" ? "I have a code" : "Create new"}
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          {mode === "create"
            ? "Create a household and invite your partner with a code."
            : "Join your partner’s household using the code."}
        </p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-lg border p-3"
            placeholder="Your name (e.g., Burak / Betül)"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
          />

          {mode === "create" ? (
            <input
              className="w-full rounded-lg border p-3"
              placeholder="Household name"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
            />
          ) : (
            <input
              className="w-full rounded-lg border p-3"
              placeholder="Household code (e.g., A1B2C3)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          )}

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          {mode === "create" ? (
            <button
              className="w-full rounded-lg bg-black p-3 text-white disabled:opacity-50"
              disabled={busy || yourName.trim().length === 0}
              onClick={onCreate}>
              {busy ? "Working..." : "Create household"}
            </button>
          ) : (
            <button
              className="w-full rounded-lg bg-black p-3 text-white disabled:opacity-50"
              disabled={
                busy || yourName.trim().length === 0 || code.trim().length < 4
              }
              onClick={onJoin}>
              {busy ? "Working..." : "Join household"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
