// app/setup/page.tsx
"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import {
  ensureUserProfile,
  getUserProfile,
  updateUserProfile,
} from "@/src/lib/profile";
import {
  createHousehold,
  getHousehold,
  joinHouseholdByCode,
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
  const email = user?.email ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState<string>("");
  const [householdCode, setHouseholdCode] = useState<string>("");

  const [createName, setCreateName] = useState("ChoreQuest Home");
  const [joinCode, setJoinCode] = useState("");

  const [busy, setBusy] = useState<string | null>(null);

  async function loadAll() {
    setError(null);
    setLoading(true);
    try {
      // ✅ Ensure profile exists so new accounts (kb) don’t hang forever
      await ensureUserProfile({ uid, email });

      const p = await getUserProfile(uid);
      setName(p?.name ?? "");
      setHouseholdId(p?.householdId ?? null);

      if (p?.householdId) {
        const h = await getHousehold(p.householdId);
        setHouseholdName(h?.name ?? "");
        setHouseholdCode(h?.code ?? "");
      } else {
        setHouseholdName("");
        setHouseholdCode("");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load setup");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function saveName() {
    setBusy("name");
    setError(null);
    try {
      await updateUserProfile(uid, { name: name.trim() });

      // Reload the page to clear Firestore cache and show updated name everywhere
      window.location.reload();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save name");
    } finally {
      setBusy(null);
    }
  }

  async function onCreateHousehold() {
    setBusy("create");
    setError(null);
    try {
      const h = await createHousehold({
        uid,
        name: createName.trim() || "Household",
      });
      await updateUserProfile(uid, { householdId: h.id });
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create household");
    } finally {
      setBusy(null);
    }
  }

  async function onJoinByCode() {
    setBusy("join");
    setError(null);
    try {
      const h = await joinHouseholdByCode({ uid, code: joinCode });
      await updateUserProfile(uid, { householdId: h.id });
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Failed to join household");
    } finally {
      setBusy(null);
    }
  }

  if (loading)
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Household setup</h1>
        <p className="text-sm text-gray-600">
          Create a household (you) or join with a code (your partner).
        </p>
        {error ? (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        ) : null}
      </div>

      {/* Name */}
      <div className="cq-card-soft p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-700">Your name</div>
          {!name.trim() ? (
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              Required
            </span>
          ) : null}
        </div>
        <input
          className="cq-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Betul or Burak"
        />
        <div className="flex items-center gap-2">
          <button
            className="cq-btn-primary"
            type="button"
            disabled={busy === "name" || !name.trim()}
            onClick={saveName}>
            {busy === "name" ? "Saving..." : "Save name"}
          </button>
          <div className="text-xs text-gray-500">
            This name is shown for assignments and score history.
          </div>
        </div>
      </div>

      {/* Connected */}
      {householdId ? (
        <div className="cq-card-soft p-5 space-y-2">
          <div className="font-semibold">Already connected</div>
          <div className="text-sm text-gray-700">
            Household:{" "}
            <span className="font-medium">{householdName || householdId}</span>
          </div>
          <div className="text-sm text-gray-700">
            Code: <span className="font-mono">{householdCode || "—"}</span>
          </div>
          <div className="text-xs text-gray-500">
            Share the code with your partner. They can join from{" "}
            <span className="font-mono">/setup</span>.
          </div>
        </div>
      ) : (
        <>
          {/* Create */}
          <div className="cq-card-soft p-5 space-y-3">
            <div className="font-semibold">Create household</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="cq-input"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Household name"
              />
              <button
                className="cq-btn-primary"
                type="button"
                disabled={busy === "create"}
                onClick={onCreateHousehold}>
                {busy === "create" ? "Creating..." : "Create household"}
              </button>
            </div>
          </div>

          {/* Join */}
          <div className="cq-card-soft p-5 space-y-3">
            <div className="font-semibold">Join household</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="cq-input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g., AB12CD)"
              />
              <button
                className="cq-btn"
                type="button"
                disabled={busy === "join"}
                onClick={onJoinByCode}>
                {busy === "join" ? "Joining..." : "Join by code"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
