"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listChoreTemplates } from "@/src/lib/chores";
import { addLedgerEntry, listLedgerEntries } from "@/src/lib/points";
import type { ChoreTemplate, PointsLedgerEntry } from "@/src/lib/types";
import { buildOccurrences } from "@/src/lib/schedule";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";

type ViewMode = "upcoming" | "completed";
type Freq = "daily" | "weekly" | "monthly" | "seasonal" | "all";

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
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [freq, setFreq] = useState<Freq>("all");
  const [view, setView] = useState<ViewMode>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
      const [t, e, m] = await Promise.all([
        listChoreTemplates(hid),
        listLedgerEntries(hid, 4000),
        listHouseholdMembers(hid),
      ]);
      setTemplates(t);
      setLedger(e);
      setMembers(m);
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

  function hashStr(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function dayIndexFromDayKey(dayKey: string) {
    const d = new Date(`${dayKey}T12:00:00`);
    return Math.floor(d.getTime() / 86400000);
  }

  function getNameByUid(uid: string | undefined) {
    if (!uid) return null;
    return members.find((m) => m.uid === uid)?.name ?? null;
  }

  function getAssigneeForOccurrence(o: Occ) {
    const mode = String(o.chore?.assigneeMode ?? "anyone");

    if (mode === "fixed") {
      const name = getNameByUid(o.chore?.fixedAssigneeUid);
      return name ? `🎯 ${name}` : "🎯 Fixed";
    }

    if (mode === "rotating") {
      if (!members.length) return "🔁 Rotating";
      const idx =
        (hashStr(o.templateId) + dayIndexFromDayKey(o.dayKey)) % members.length;
      return `🔁 ${members[idx].name}`;
    }

    return "👥 Anyone";
  }

  async function complete(templateId: string, dayKey: string, chore: ChoreTemplate) {
    if (!householdId) return;

    const key = `${templateId}__${dayKey}`;
    setError(null);
    setBusyKey(key);

    try {
      const st = statusByKey.get(key);
      if (st && st.completedCount > 0) {
        setError("Already completed for this day.");
        return;
      }

      await addLedgerEntry(householdId, {
        actorUid: uid,
        delta: chore.points,
        reason: `Completed: ${chore.title}`,
        createdAt: Date.now(),
        templateId,
        dayKey,
      });

      const e = await listLedgerEntries(householdId, 4000);
      setLedger(e);
    } catch (e: any) {
      setError(e?.message ?? "Failed to complete");
    } finally {
      setBusyKey(null);
    }
  }

  async function skip(templateId: string, dayKey: string, chore: ChoreTemplate) {
    if (!householdId) return;

    const key = `${templateId}__${dayKey}`;
    setError(null);
    setBusyKey(key);

    try {
      const st = statusByKey.get(key);
      if (st?.skipped) {
        setError("Already skipped for this day.");
        return;
      }

      await addLedgerEntry(householdId, {
        actorUid: uid,
        delta: 0,
        reason: `Skipped: ${chore.title}`,
        createdAt: Date.now(),
        templateId,
        dayKey,
      });

      const e = await listLedgerEntries(householdId, 4000);
      setLedger(e);
    } catch (e: any) {
      setError(e?.message ?? "Failed to skip");
    } finally {
      setBusyKey(null);
    }
  }

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
    if (freq === "all") return occurrencesAll;

    const want = freq;
    return occurrencesAll.filter((o) => {
      const f = String(o.chore.frequency ?? "").toLowerCase();
      return f === want;
    });
  }, [occurrencesAll, freq]);

  const filteredBySearch: Occ[] = useMemo(() => {
    if (!searchQuery.trim()) return byFreq;

    const query = searchQuery.toLowerCase();
    return byFreq.filter((o) => {
      const title = String(o.chore.title ?? "").toLowerCase();
      return title.includes(query);
    });
  }, [byFreq, searchQuery]);

  const isCompleted = (o: Occ) => {
    const key = `${o.templateId}__${o.dayKey}`;
    const st = statusByKey.get(key);
    if (!st) return false;
    if (st.skipped) return false;
    return st.completedCount > 0;
  };

  const upcomingList = useMemo(
    () => filteredBySearch.filter((o) => !isCompleted(o)),
    [filteredBySearch, statusByKey],
  );

  const completedList = useMemo(
    () => filteredBySearch.filter((o) => isCompleted(o)),
    [filteredBySearch, statusByKey],
  );

  const visible = view === "completed" ? completedList : upcomingList;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="cq-card p-5">
        <div className="flex items-center gap-3">
          <div className="text-4xl">📋</div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Plan Ahead</h1>
            <p className="text-sm text-gray-500">
              View and complete chores for the next 30 days
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        ) : null}
      </div>

      {/* Search & Filters */}
      <div className="cq-card p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Search chores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Frequency Filter */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">Frequency</div>
          <div className="flex flex-wrap gap-2">
            {(["all", "daily", "weekly", "monthly", "seasonal"] as Freq[]).map(
              (f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  className={
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all " +
                    (freq === f
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200")
                  }>
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setView("upcoming")}
            className={
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all " +
              (view === "upcoming"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700")
            }>
            <span>⏳</span>
            <span>Upcoming</span>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-semibold">
              {upcomingList.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView("completed")}
            className={
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all " +
              (view === "completed"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700")
            }>
            <span>✓</span>
            <span>Done</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-xs font-semibold">
              {completedList.length}
            </span>
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {loading ? (
          <div className="cq-card p-8 text-center">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : null}

        {!loading && visible.length === 0 ? (
          <div className="cq-card p-8 text-center">
            <div className="text-5xl mb-3">
              {view === "completed" ? "🎯" : "✨"}
            </div>
            <div className="font-semibold text-gray-700">
              {view === "completed" ? "No completed chores yet" : "All caught up!"}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {view === "completed"
                ? "Complete some chores to see them here"
                : "No upcoming chores match your filters"}
            </div>
          </div>
        ) : null}

        {visible.map((o) => {
          const key = `${o.templateId}__${o.dayKey}`;
          const date = new Date(o.dueMs);
          const isToday = date.toDateString() === new Date().toDateString();
          const isTomorrow =
            date.toDateString() ===
            new Date(Date.now() + 86400000).toDateString();
          const isUpcoming = view === "upcoming";
          const isBusy = busyKey === key;

          return (
            <div
              key={key}
              className={
                "cq-card p-4 transition-shadow hover:shadow-md " +
                (isToday ? "ring-2 ring-emerald-200 bg-emerald-50/30" : "")
              }>
              <div className="flex flex-col gap-3">
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-base">{o.chore.title}</div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <span>📅</span>
                        <span>{o.dayKey}</span>
                      </span>
                      <span className="text-gray-300">•</span>
                      <span>{getAssigneeForOccurrence(o)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isToday ? (
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700">
                        Today
                      </span>
                    ) : isTomorrow ? (
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                        Tomorrow
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">
                      <span>🪙</span>
                      <span>{o.chore.points}</span>
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                {isUpcoming && (
                  <div className="flex items-center gap-2">
                    <button
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 active:scale-[0.98] transition-all disabled:opacity-60"
                      onClick={() => complete(o.templateId, o.dayKey, o.chore)}
                      disabled={isBusy}
                      type="button">
                      {isBusy ? "..." : `✓ Complete (+${o.chore.points})`}
                    </button>
                    <button
                      className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60"
                      onClick={() => skip(o.templateId, o.dayKey, o.chore)}
                      disabled={isBusy}
                      type="button">
                      Skip
                    </button>
                  </div>
                )}

                {/* Completed state */}
                {!isUpcoming && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <span>✓</span>
                    <span>Completed</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
