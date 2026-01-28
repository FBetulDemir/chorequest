"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listChoreTemplates } from "@/src/lib/chores";
import { listLedgerEntries } from "@/src/lib/points";
import type { ChoreTemplate, PointsLedgerEntry } from "@/src/lib/types";
import { buildOccurrences } from "@/src/lib/schedule";

type ViewMode = "upcoming" | "completed";
type Freq = "daily" | "weekly" | "monthly" | "seasonal";

function localDayKey(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDayMs(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type Occ = {
  templateId: string;
  dayKey: string;
  dueMs: number;
  chore: ChoreTemplate;
};

function buildStatusByOccurrenceLocal(
  ledger: PointsLedgerEntry[],
): Map<string, { completedCount: number; skipped: boolean }> {
  const map = new Map<string, { completedCount: number; skipped: boolean }>();

  for (const e of ledger || []) {
    const templateId = e.templateId ? String(e.templateId) : "";
    if (!templateId) continue;

    // Important: use local dayKey from createdAt to avoid UTC/local mismatches.
    const dk = localDayKey(Number(e.createdAt ?? Date.now()));
    const key = `${templateId}__${dk}`;

    const cur = map.get(key) ?? { completedCount: 0, skipped: false };

    const reason = String(e.reason ?? "");
    const delta = Number(e.delta ?? 0);

    if (reason.startsWith("Completed:") && delta > 0) cur.completedCount += 1;
    if (reason.startsWith("Undo:") && delta < 0)
      cur.completedCount = Math.max(0, cur.completedCount - 1);
    if (reason.startsWith("Skipped:")) cur.skipped = true;

    map.set(key, cur);
  }

  return map;
}

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

  const [freq, setFreq] = useState<Freq>("daily");
  const [view, setView] = useState<ViewMode>("upcoming");

  useEffect(() => {
    async function loadProfile() {
      const p = await getUserProfile(uid);
      setHouseholdId(p?.householdId ?? null);
    }
    loadProfile();
  }, [uid]);

  async function refresh(hid: string) {
    setError(null);
    setLoading(true);
    try {
      const [t, e] = await Promise.all([
        listChoreTemplates(hid),
        listLedgerEntries(hid, 4000),
      ]);
      setTemplates(t);
      setLedger(e);
      // TEMP DEBUG: show completions for dishes
      const dishes = e.filter(
        (x) =>
          String(x.reason ?? "").startsWith("Completed:") &&
          String(x.templateId ?? "").length > 0,
      );
      console.log("ledger completions", dishes.slice(0, 20));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!householdId) return;
    refresh(householdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const occurrencesAll: Occ[] = useMemo(() => {
    const now = Date.now();
    const base = startOfLocalDayMs(now);
    const raw = buildOccurrences(templates, base, 30) as any[];

    return raw
      .map((o) => {
        const dueMs =
          typeof o.dueMs === "number"
            ? o.dueMs
            : typeof o.ts === "number"
              ? o.ts
              : base;

        const dk = typeof o.dayKey === "string" ? o.dayKey : localDayKey(dueMs);

        return {
          templateId: String(o.templateId),
          dayKey: dk,
          dueMs,
          chore: o.chore as ChoreTemplate,
        } as Occ;
      })
      .sort((a, b) => a.dueMs - b.dueMs);
  }, [templates]);

  const statusByKey = useMemo(
    () => buildStatusByOccurrenceLocal(ledger),
    [ledger],
  );

  const byFreq: Occ[] = useMemo(() => {
    const want = freq;
    return occurrencesAll.filter((o) => {
      const f = String(o.chore.frequency ?? "").toLowerCase();
      return f === want;
    });
  }, [occurrencesAll, freq]);

  const isCompleted = (o: Occ) => {
    const key = `${o.templateId}__${o.dayKey}`;
    const st = statusByKey.get(key);
    if (!st) return false;
    if (st.skipped) return false;
    return st.completedCount > 0;
  };

  const upcomingList = useMemo(
    () => byFreq.filter((o) => !isCompleted(o)),
    [byFreq, statusByKey],
  );

  const completedList = useMemo(
    () => byFreq.filter((o) => isCompleted(o)),
    [byFreq, statusByKey],
  );

  const visible = view === "completed" ? completedList : upcomingList;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 space-y-5">
      <div className="cq-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="cq-title">Plan</div>
            <div className="cq-subtitle">
              Upcoming and completed chores by frequency
            </div>
          </div>
          <div className="text-xs text-gray-500">Horizon: next 30 days</div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TabButton active={freq === "daily"} onClick={() => setFreq("daily")}>
            Daily
          </TabButton>
          <TabButton
            active={freq === "weekly"}
            onClick={() => setFreq("weekly")}>
            Weekly
          </TabButton>
          <TabButton
            active={freq === "monthly"}
            onClick={() => setFreq("monthly")}>
            Monthly
          </TabButton>
          <TabButton
            active={freq === "seasonal"}
            onClick={() => setFreq("seasonal")}>
            Seasonal
          </TabButton>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <TabButton
            active={view === "upcoming"}
            onClick={() => setView("upcoming")}>
            Upcoming ({upcomingList.length})
          </TabButton>
          <TabButton
            active={view === "completed"}
            onClick={() => setView("completed")}>
            Completed ({completedList.length})
          </TabButton>
        </div>

        {error ? (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        ) : null}
      </div>

      <div className="cq-card-soft p-5">
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : null}

        {!loading && visible.length === 0 ? (
          <div className="cq-card p-8 text-center">
            <div className="text-5xl mb-3">📭</div>
            <div className="font-semibold text-gray-700">Nothing here</div>
            <div className="text-sm text-gray-500 mt-1">
              No {view === "completed" ? "completed" : "upcoming"} chores in this
              frequency
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {visible.map((o) => {
            const key = `${o.templateId}__${o.dayKey}`;
            const date = new Date(o.dueMs);
            const isToday =
              date.toDateString() === new Date().toDateString();
            const isTomorrow =
              date.toDateString() ===
              new Date(Date.now() + 86400000).toDateString();

            return (
              <div
                key={key}
                className={
                  "cq-card p-4 transition-shadow hover:shadow-md " +
                  (isToday ? "border-l-4 border-l-emerald-500" : "")
                }>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="truncate font-semibold text-base">
                        {o.chore.title}
                      </div>
                      {isToday ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">
                          Today
                        </span>
                      ) : isTomorrow ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
                          Tomorrow
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-gray-500">
                      <span>📅 {o.dayKey}</span>
                      <span>•</span>
                      <span className="capitalize">
                        {String(o.chore.frequency)}
                      </span>
                      <span>•</span>
                      <span className="capitalize">
                        {String(o.chore.assigneeMode)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                      <span>🪙</span>
                      <span>{Number(o.chore.points ?? 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
        "cq-btn rounded-2xl px-5 py-2.5 " +
        (active ? "text-white" : "text-gray-900")
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
