"use client";

import React, { useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { recordCompletion, recordSkip } from "@/src/lib/points";
import { buildOccurrences, type Occurrence } from "@/src/lib/schedule";
import {
  buildStatusByOccurrence,
  isOccurrenceDone,
  occurrenceKey,
} from "@/src/lib/ledgerHelpers";
import { assigneeLabel } from "@/src/lib/assignee";
import { friendlyError } from "@/src/lib/errors";
import { useTodayStartMs } from "@/src/lib/useToday";

type ViewMode = "upcoming" | "completed";
type Freq = "daily" | "weekly" | "monthly" | "seasonal" | "all";

export default function PlanPage() {
  return (
    <RequireAuth>
      <PlanInner />
    </RequireAuth>
  );
}

function PlanInner() {
  const { uid, householdId, members, templates, ledger, dataLoading } =
    useReadyHousehold();
  const loading = dataLoading;

  const [error, setError] = useState<string | null>(null);
  const [freq, setFreq] = useState<Freq>("all");
  const [view, setView] = useState<ViewMode>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const todayStartMs = useTodayStartMs();
  const tomorrowStartMs = useMemo(() => {
    const d = new Date(todayStartMs);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }, [todayStartMs]);

  const statusByKey = useMemo(() => buildStatusByOccurrence(ledger), [ledger]);

  async function run(key: string, action: () => Promise<unknown>) {
    setError(null);
    setBusyKey(key);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyKey(null);
    }
  }

  function complete(o: Occurrence) {
    const key = occurrenceKey(o.templateId, o.dayKey);
    return run(key, () =>
      recordCompletion({
        householdId,
        uid,
        chore: o.chore,
        dayKey: o.dayKey,
        status: statusByKey.get(key),
      }),
    );
  }

  function skip(o: Occurrence) {
    const key = occurrenceKey(o.templateId, o.dayKey);
    return run(key, () =>
      recordSkip({
        householdId,
        uid,
        chore: o.chore,
        dayKey: o.dayKey,
        status: statusByKey.get(key),
      }),
    );
  }

  // Next 30 days of active chores, soonest first, without skipped ones
  const occurrencesAll = useMemo(
    () =>
      buildOccurrences(
        templates.filter((t) => t.active),
        todayStartMs,
        30,
      ).filter(
        (o) => !statusByKey.get(occurrenceKey(o.templateId, o.dayKey))?.skipped,
      ),
    [templates, todayStartMs, statusByKey],
  );

  const byFreq = useMemo(() => {
    if (freq === "all") return occurrencesAll;
    return occurrencesAll.filter((o) => o.chore.frequency === freq);
  }, [occurrencesAll, freq]);

  const filteredBySearch = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return byFreq;
    return byFreq.filter((o) => o.chore.title.toLowerCase().includes(query));
  }, [byFreq, searchQuery]);

  const upcomingList = useMemo(
    () =>
      filteredBySearch.filter(
        (o) => !isOccurrenceDone(statusByKey.get(occurrenceKey(o.templateId, o.dayKey))),
      ),
    [filteredBySearch, statusByKey],
  );

  const completedList = useMemo(
    () =>
      filteredBySearch.filter((o) =>
        isOccurrenceDone(statusByKey.get(occurrenceKey(o.templateId, o.dayKey))),
      ),
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
                ? "bg-surface text-gray-900 shadow-sm"
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
                ? "bg-surface text-gray-900 shadow-sm"
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
          const key = occurrenceKey(o.templateId, o.dayKey);
          const isToday = o.dateMs === todayStartMs;
          const isTomorrow = o.dateMs === tomorrowStartMs;
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
                      <span>{assigneeLabel(o.chore, o.dayKey, members)}</span>
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
                      onClick={() => complete(o)}
                      disabled={isBusy}
                      type="button">
                      {isBusy ? "..." : `✓ Complete (+${o.chore.points})`}
                    </button>
                    <button
                      className="px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-gray-600 border border-gray-200 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60"
                      onClick={() => skip(o)}
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
