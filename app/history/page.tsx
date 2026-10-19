"use client";

import React, { useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { recordUndo } from "@/src/lib/points";
import {
  buildStatusByOccurrence,
  entryKind,
  entryOccurrenceKey,
  entryTitle,
  findUndoneCompletionIds,
} from "@/src/lib/ledgerHelpers";
import { friendlyError } from "@/src/lib/errors";
import type { PointsLedgerEntry } from "@/src/lib/types";

export default function HistoryPage() {
  return (
    <RequireAuth>
      <HistoryInner />
    </RequireAuth>
  );
}

function HistoryInner() {
  const { uid, householdId, members, ledger, dataLoading } = useReadyHousehold();
  const loading = dataLoading;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (u: string) =>
    members.find((m) => m.uid === u)?.name ?? "Member";

  // show only meaningful stuff in UI
  const rows = useMemo(
    () => ledger.filter((x) => entryKind(x) !== "other"),
    [ledger],
  );

  const undoneIds = useMemo(() => findUndoneCompletionIds(ledger), [ledger]);
  const statusByKey = useMemo(() => buildStatusByOccurrence(ledger), [ledger]);

  async function undo(e: PointsLedgerEntry) {
    const key = entryOccurrenceKey(e);
    setBusyId(e.id);
    setError(null);
    try {
      await recordUndo({
        householdId,
        uid,
        completion: e,
        status: key ? statusByKey.get(key) : undefined,
      });
    } catch (err) {
      setError(friendlyError(err, "Couldn't undo. Please try again."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="cq-card p-5 flex items-start justify-between">
        <div>
          <div className="cq-title">History</div>
          <div className="cq-subtitle">Everything your household did</div>
          {error ? (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          ) : null}
        </div>

      </div>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      <div className="space-y-3">
        {rows.map((e) => {
          const kind = entryKind(e);
          const who = nameOf(String(e.actorUid ?? ""));
          const ts = Number(e.createdAt ?? 0);
          const when = ts ? new Date(ts).toLocaleString() : "";

          const isCompleted = kind === "complete";
          const isSkipped = kind === "skip";
          const wasUndone = isCompleted && undoneIds.has(e.id);

          const icon = isCompleted ? "✓" : isSkipped ? "⏭️" : "↩️";
          const badgeColor = isCompleted
            ? "bg-emerald-100 text-emerald-700"
            : isSkipped
              ? "bg-gray-100 text-gray-700"
              : "bg-amber-100 text-amber-700";

          return (
            <div key={e.id} className="cq-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 border border-gray-100 shrink-0 text-lg">
                    {icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-base truncate">
{entryTitle(e)}
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {who} • {when}
                    </div>

                    <div className="mt-2">
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold " +
                          badgeColor
                        }>
                        {isCompleted
                          ? "Completed"
                          : isSkipped
                            ? "Skipped"
                            : "Undone"}
                      </span>
                      {wasUndone ? (
                        <span className="ml-2 text-xs text-gray-400">
                          (undone later)
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {Number(e.delta ?? 0) !== 0 ? (
                    <div
                      className={
                        "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold " +
                        (Number(e.delta ?? 0) > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700")
                      }>
                      {Number(e.delta ?? 0) > 0
                        ? `+${e.delta}`
                        : `${e.delta}`}{" "}
                      pts
                    </div>
                  ) : null}

                  {isCompleted && !wasUndone && e.templateId && e.dayKey ? (
                    <button
                      className="cq-btn"
                      type="button"
                      onClick={() => undo(e)}
                      disabled={busyId === e.id}>
                      {busyId === e.id ? "…" : "Undo"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && rows.length === 0 ? (
          <div className="cq-card p-8 text-center">
            <div className="text-5xl mb-3">📜</div>
            <div className="font-semibold text-gray-700">No history yet</div>
            <div className="text-sm text-gray-500 mt-1">
              Activity will appear here once chores are completed
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
