"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listChoreTemplates } from "@/src/lib/chores";
import type { ChoreTemplate, Frequency } from "@/src/types";
import {
  formatDateShort,
  listRecentCompletions,
  nextDueDates,
} from "@/src/lib/plan";

const tabs: Frequency[] = ["daily", "weekly", "monthly", "seasonal"];

const tabLabel: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  seasonal: "Seasonal",
};

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

  const [tab, setTab] = useState<Frequency>("daily");
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [completed, setCompleted] = useState<
    {
      id: string;
      title?: string;
      icon?: string;
      points?: number;
      completedAt?: number;
      completedByName?: string;
    }[]
  >([]);
  const [completedErr, setCompletedErr] = useState<string | null>(null);

  // load household id
  useEffect(() => {
    (async () => {
      const p = await getUserProfile(uid);
      setHouseholdId(p?.householdId ?? null);
    })();
  }, [uid]);

  // load templates
  useEffect(() => {
    if (!householdId) return;

    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const list = await listChoreTemplates(householdId);
        setTemplates(list);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load chores");
      } finally {
        setLoading(false);
      }
    })();
  }, [householdId]);

  // load completed for this tab
  useEffect(() => {
    if (!householdId) return;

    (async () => {
      setCompletedErr(null);
      try {
        const items = await listRecentCompletions(householdId, tab, 10);
        setCompleted(items);
      } catch (e: any) {
        // This often fails if your completion docs don’t have "frequency" or you need an index.
        setCompleted([]);
        setCompletedErr(
          e?.message ??
            "Could not load completed items (check completion collection name / fields).",
        );
      }
    })();
  }, [householdId, tab]);

  const upcoming = useMemo(() => {
    const active = templates.filter((t) => t.active !== false);
    const filtered = active.filter((t) => t.frequency === tab);

    // produce a flat list of next occurrences
    const occurrences = filtered.flatMap((t) =>
      nextDueDates(t, 3).map((ms) => ({
        templateId: t.id,
        title: t.title,
        icon: (t as any).icon as string | undefined,
        points: t.points,
        assigneeMode: t.assigneeMode,
        dueAt: ms,
      })),
    );

    // sort by date
    occurrences.sort((a, b) => a.dueAt - b.dueAt);

    // cap
    return occurrences.slice(0, 12);
  }, [templates, tab]);

  if (!householdId) {
    return <div className="text-sm text-gray-500">Loading household…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="cq-card p-5">
        <div className="cq-title">Chore Calendar</div>
        <div className="cq-subtitle">
          Plan and organize your household tasks
        </div>
        {err ? <div className="mt-2 text-sm text-red-600">{err}</div> : null}
      </div>

      {/* Tabs */}
      <div className="cq-card p-3">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "rounded-xl border px-3 py-3 text-sm " +
                (tab === t ? "text-white" : "bg-white")
              }
              style={
                tab === t
                  ? {
                      background:
                        "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
                      borderColor: "transparent",
                    }
                  : { borderColor: "var(--cq-border)" }
              }>
              {tabLabel[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div className="cq-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-800">Upcoming</div>
            <div className="text-xs text-gray-500">
              Next scheduled chores for this category
            </div>
          </div>
          {loading ? (
            <div className="text-xs text-gray-500">Loading…</div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {!loading && upcoming.length === 0 ? (
            <div className="cq-card-soft p-4 text-sm text-gray-600">
              No upcoming chores yet.
            </div>
          ) : null}

          {upcoming.map((u, idx) => (
            <div
              key={`${u.templateId}-${u.dueAt}-${idx}`}
              className="cq-card-soft p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {u.icon ? <span className="mr-2">{u.icon}</span> : null}
                    {u.title}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {formatDateShort(u.dueAt)} • {tab} • {u.assigneeMode}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="cq-pill">🪙 {u.points} pts</span>
                  <button className="cq-btn" type="button" disabled>
                    Complete
                  </button>
                  <button className="cq-btn" type="button" disabled>
                    Skip
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Completed */}
      <div className="cq-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-800">Completed</div>
            <div className="text-xs text-gray-500">
              Recently completed chores for this category
            </div>
          </div>
        </div>

        {completedErr ? (
          <div className="mt-3 text-xs text-amber-700">
            {completedErr}
            <div className="mt-1 text-[11px] text-amber-700/80">
              Tip: open <code>src/lib/plan.ts</code> and set{" "}
              <code>COMPLETIONS_COLLECTION</code> to the collection your Today
              page uses.
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {completed.length === 0 ? (
            <div className="cq-card-soft p-4 text-sm text-gray-600">
              No completed chores yet.
            </div>
          ) : null}

          {completed.map((c) => (
            <div key={c.id} className="cq-card-soft p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {c.icon ? <span className="mr-2">{c.icon}</span> : null}
                    {c.title ?? "Chore"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {c.completedAt ? formatDateShort(c.completedAt) : ""}{" "}
                    {c.completedByName ? `• ${c.completedByName}` : ""}
                  </div>
                </div>

                <div className="cq-pill">+{Number(c.points ?? 0)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
