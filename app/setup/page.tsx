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
    <div className="space-y-6">
      {/* Header */}
      <div className="cq-card p-5">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🏠</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Setup</h1>
            <p className="text-sm text-gray-500">
              Get your household ready for ChoreQuest
            </p>
          </div>
        </div>
        {error ? (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        ) : null}
      </div>

      {/* Step 1: Your Profile */}
      <div className="cq-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <div className="font-semibold text-gray-900">Your Profile</div>
            <div className="text-xs text-gray-500">How should we call you?</div>
          </div>
          {name.trim() ? (
            <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              ✓ Done
            </span>
          ) : (
            <span className="ml-auto text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Required
            </span>
          )}
        </div>

        <div className="pl-11 space-y-3">
          <input
            className="cq-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name (e.g., Betül)"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              className="cq-btn-primary"
              type="button"
              disabled={busy === "name" || !name.trim()}
              onClick={saveName}>
              {busy === "name" ? "Saving..." : "Save Name"}
            </button>
            <div className="text-xs text-gray-500">
              Your name appears on chore assignments and the leaderboard.
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Household */}
      <div className="cq-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <div>
            <div className="font-semibold text-gray-900">Your Household</div>
            <div className="text-xs text-gray-500">
              Connect with family or roommates
            </div>
          </div>
          {householdId ? (
            <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              ✓ Connected
            </span>
          ) : (
            <span className="ml-auto text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Required
            </span>
          )}
        </div>

        <div className="pl-11">
          {householdId ? (
            /* Already connected */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <span>✓</span>
                  <span>Connected to {householdName || "your household"}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="text-sm font-medium text-gray-700">
                  Invite Others
                </div>
                <div className="text-xs text-gray-500">
                  Share this code with family members or roommates so they can
                  join your household:
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-dashed border-purple-200 font-mono text-lg text-center text-purple-600 font-bold tracking-wider">
                    {householdCode || "—"}
                  </div>
                  <button
                    className="cq-btn text-xs"
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(householdCode);
                    }}>
                    Copy
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  They just need to sign up, go to Setup, and enter this code.
                </div>
              </div>
            </div>
          ) : (
            /* Not connected - show options */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
                <strong>What's a household?</strong>
                <p className="mt-1 text-blue-600">
                  A household is your shared space in ChoreQuest. Everyone in
                  the same household shares chores, earns points together, and
                  competes on the leaderboard.
                </p>
              </div>

              {/* Option A: Create */}
              <div className="p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <div>
                    <div className="font-medium text-gray-900">
                      Start a New Household
                    </div>
                    <div className="text-xs text-gray-500">
                      You're the first one here? Create a household and invite
                      others.
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="cq-input flex-1"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Household name (e.g., The Smiths)"
                  />
                  <button
                    className="cq-btn-primary whitespace-nowrap"
                    type="button"
                    disabled={busy === "create"}
                    onClick={onCreateHousehold}>
                    {busy === "create" ? "Creating..." : "Create Household"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-200" />
                <span>OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Option B: Join */}
              <div className="p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔗</span>
                  <div>
                    <div className="font-medium text-gray-900">
                      Join an Existing Household
                    </div>
                    <div className="text-xs text-gray-500">
                      Got an invite code from someone? Enter it here.
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="cq-input flex-1 font-mono uppercase tracking-wider"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g., AB12CD)"
                    maxLength={10}
                  />
                  <button
                    className="cq-btn whitespace-nowrap"
                    type="button"
                    disabled={busy === "join" || !joinCode.trim()}
                    onClick={onJoinByCode}>
                    {busy === "join" ? "Joining..." : "Join Household"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* What's next */}
      {householdId && name.trim() ? (
        <div className="cq-card p-5">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎉</div>
            <div>
              <div className="font-semibold text-gray-900">You're all set!</div>
              <div className="text-sm text-gray-500">
                Head to <strong>Chores</strong> to add tasks, or{" "}
                <strong>Today</strong> to see what's due.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
