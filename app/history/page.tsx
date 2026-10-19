"use client";

import React, { useMemo, useState } from "react";
import clsx from "clsx";
import { RotateCcw } from "lucide-react";

import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { useChoreActions } from "@/src/components/useChoreActions";
import { Button } from "@/src/components/ui/Button";
import { Avatar, EmptyState, ListSkeleton } from "@/src/components/ui/Display";
import { entryKind, entryTitle, findUndoneCompletionIds } from "@/src/lib/ledgerHelpers";
import { dayKeyFromTs } from "@/src/lib/schedule";
import { friendlyDay, timeOfDay } from "@/src/lib/dates";
import { splitChoreTitle } from "@/src/lib/choreCatalog";
import { useTodayStartMs } from "@/src/lib/useToday";
import type { PointsLedgerEntry } from "@/src/lib/types";

const PAGE_SIZE = 60;

export default function HistoryPage() {
  return (
    <RequireAuth>
      <HistoryInner />
    </RequireAuth>
  );
}

function HistoryInner() {
  const { uid, members, ledger, dataLoading } = useReadyHousehold();
  const { undo } = useChoreActions();
  const todayStartMs = useTodayStartMs();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // show only meaningful stuff in UI
  const rows = useMemo(() => ledger.filter((x) => entryKind(x) !== "other"), [ledger]);
  const undoneIds = useMemo(() => findUndoneCompletionIds(ledger), [ledger]);

  const byDay = useMemo(() => {
    const map = new Map<string, PointsLedgerEntry[]>();
    for (const e of rows.slice(0, limit)) {
      const key = dayKeyFromTs(Number(e.createdAt ?? 0));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows, limit]);

  const memberOf = (u: string) => members.find((m) => m.uid === u);

  async function onUndo(e: PointsLedgerEntry) {
    setBusyId(e.id);
    try {
      await undo(e);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Activity</h1>
        <p className="text-sm text-muted">Everything your household did. Tap undo if something was a mistake.</p>
      </div>

      {dataLoading ? <ListSkeleton rows={5} /> : null}

      {!dataLoading && rows.length === 0 ? (
        <EmptyState
          mood="sleepy"
          title="No activity yet"
          description="Completed and skipped chores will show up here."
        />
      ) : null}

      {byDay.map(([dayKey, entries]) => (
        <section key={dayKey} className="space-y-2" aria-label={friendlyDay(dayKey, todayStartMs)}>
          <div className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">
            {friendlyDay(dayKey, todayStartMs)}
          </div>
          <div className="cq-card divide-y divide-line overflow-hidden">
            {entries.map((e) => {
              const kind = entryKind(e);
              const who = memberOf(e.actorUid);
              const whoName = e.actorUid === uid ? "You" : (who?.name ?? "Someone");
              const { icon, name } = splitChoreTitle(entryTitle(e));
              const wasUndone = kind === "complete" && undoneIds.has(e.id);
              const canUndo = kind === "complete" && !wasUndone && !!e.templateId && !!e.dayKey;
              const verb = kind === "complete" ? "completed" : kind === "skip" ? "skipped" : "undid";

              return (
                <div key={e.id} className={clsx("flex items-center gap-3 px-4 py-3", (kind !== "complete" || wasUndone) && "opacity-70")}>
                  <div className="relative shrink-0">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-surface-2 text-xl" aria-hidden="true">
                      {icon}
                    </span>
                    {who ? (
                      <Avatar uid={who.uid} name={who.name} emoji={who.avatar} size={20} ring className="absolute -bottom-1 -right-1" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={clsx("truncate text-sm font-bold text-ink", wasUndone && "line-through")}>{name}</div>
                    <div className="text-xs text-muted">
                      {whoName} {verb} · {timeOfDay(Number(e.createdAt))}
                      {wasUndone ? " · undone" : ""}
                    </div>
                  </div>
                  {Number(e.delta) !== 0 ? (
                    <span
                      className={clsx(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold",
                        Number(e.delta) > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                      )}>
                      {Number(e.delta) > 0 ? `+${e.delta}` : e.delta}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">Skipped</span>
                  )}
                  {canUndo ? (
                    <Button size="sm" variant="ghost" loading={busyId === e.id} onClick={() => onUndo(e)} aria-label={`Undo ${name}`}>
                      {busyId === e.id ? null : <RotateCcw size={15} aria-hidden="true" />}
                      <span className="hidden sm:inline">Undo</span>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {rows.length > limit ? (
        <div className="flex justify-center">
          <Button onClick={() => setLimit((l) => l + PAGE_SIZE)}>Show more</Button>
        </div>
      ) : null}
    </div>
  );
}
