// app/plan/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listChoreTemplates } from "@/src/lib/chores";
import { listLedgerEntries } from "@/src/lib/points";
import type {
  ChoreTemplate,
  Frequency,
  PointsLedgerEntry,
} from "@/src/lib/types";
import { buildOccurrences } from "@/src/lib/schedule";
import { buildStatusByOccurrence } from "@/src/lib/ledgerHelpers";

type ViewMode = "upcoming" | "completed";

const freqTabs: Frequency[] = ["daily", "weekly", "monthly", "seasonal"];

export default function PlanPage() {
  return (
    <RequireAuth>
      <PlanInner />
    </RequireAuth>
  );
}

function PlanInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [freq, setFreq] = useState<Frequency>("weekly");
  const [mode, setMode] = useState<ViewMode>("upcoming");

  useEffect(() => {
    async function boot() {
      const p = await getUserProfile(uid);
      setHouseholdId(p?.householdId ?? null);
    }
    boot();
  }, [uid]);

  async function refresh(hid: string) {
    setError(null);
    setLoading(true);
    try {
      const [t, e] = await Promise.all([
        listChoreTemplates(hid),
        listLedgerEntries(hid, 5000),
      ]);
      setTemplates(t);
      setLedger(e);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!householdId) return;
    refresh(householdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const statusByKey = useMemo(() => buildStatusByOccurrence(ledger), [ledger]);

  // Horizon: next 30 days
  const occurrences = useMemo(
    () => buildOccurrences(templates, Date.now(), 30),
    [templates],
  );

  const filtered = useMemo(() => {
    const relevant = occurrences.filter((o) => o.chore.frequency === freq);

    if (mode === "upcoming") {
      return relevant.filter((o) => {
        const k = `${o.templateId}__${o.dayKey}`;
        const st = statusByKey.get(k);
        if (!st) return true;
        if (st.skipped) return false;
        return st.completed <= 0;
      });
    }

    // completed
    return relevant.filter((o) => {
      const k = `${o.templateId}__${o.dayKey}`;
      const st = statusByKey.get(k);
      return Boolean(st && st.completed > 0);
    });
  }, [occurrences, freq, mode, statusByKey]);

  const counts = useMemo(() => {
    const base = { upcoming: 0, completed: 0 };
    const relevant = occurrences.filter((o) => o.chore.frequency === freq);
    for (const o of relevant) {
      const k = `${o.templateId}__${o.dayKey}`;
      const st = statusByKey.get(k);
      const completed = Boolean(st && st.completed > 0);
      const skipped = Boolean(st && st.skipped);

      if (completed) base.completed += 1;
      else if (!skipped) base.upcoming += 1;
    }
    return base;
  }, [occurrences, freq, statusByKey]);

  if (!householdId)
    return <div className="p-6 text-sm text-gray-500">Loading household…</div>;

  return (
    <div className="space-y-5">
      <div className="cq-card p-5 flex items-start justify-between">
        <div>
          <div className="cq-title">Plan</div>
          <div className="cq-subtitle">
            Upcoming and completed chores by frequency
          </div>
        </div>
        <div className="text-sm text-gray-500">Horizon: next 30 days</div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      {/* Frequency tabs */}
      <div className="grid grid-cols-4 gap-3">
        {freqTabs.map((f) => (
          <TabButton key={f} active={freq === f} onClick={() => setFreq(f)}>
            {labelFreq(f)}
          </TabButton>
        ))}
      </div>

      {/* Upcoming / Completed */}
      <div className="grid grid-cols-2 gap-3">
        <TabButton
          active={mode === "upcoming"}
          onClick={() => setMode("upcoming")}>
          Upcoming ({counts.upcoming})
        </TabButton>
        <TabButton
          active={mode === "completed"}
          onClick={() => setMode("completed")}>
          Completed ({counts.completed})
        </TabButton>
      </div>

      <div className="cq-card p-5">
        <div className="flex items-end justify-between">
          <div className="text-lg font-semibold">
            {mode === "upcoming" ? "Upcoming" : "Completed"} — {freq}
          </div>
          <div className="text-sm text-gray-500">{filtered.length} items</div>
        </div>

        <div className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-sm text-gray-500">Nothing here.</div>
          ) : null}

          {filtered.map((o) => {
            const key = `${o.templateId}__${o.dayKey}`;
            return (
              <div key={key} className="cq-card-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{o.chore.title}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {humanDayLabel(o.dayKey)} • {o.chore.assigneeMode}
                    </div>
                  </div>
                  <div className="cq-pill">🪙 {o.chore.points}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          className="cq-btn"
          onClick={() => refresh(householdId)}
          disabled={loading}>
          Refresh
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-2xl border px-5 py-4 text-center text-sm transition " +
        (active ? "text-white" : "bg-white")
      }
      style={
        active
          ? {
              background:
                "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
              borderColor: "transparent",
            }
          : { borderColor: "var(--cq-border)" }
      }>
      {children}
    </button>
  );
}

function labelFreq(f: Frequency) {
  if (f === "daily") return "Daily";
  if (f === "weekly") return "Weekly";
  if (f === "monthly") return "Monthly";
  return "Seasonal";
}

// If your dayKey is already formatted like YYYY-MM-DD, we keep it.
// If you want prettier labels later, we can do that in styling step.
function humanDayLabel(dayKey: string) {
  return dayKey;
}
