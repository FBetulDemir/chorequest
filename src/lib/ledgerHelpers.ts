// src/lib/ledgerHelpers.ts
import type { LedgerEntryType, PointsLedgerEntry } from "@/src/lib/types";
import { dayKeyFromTs } from "@/src/lib/schedule";

export type RangeKey = "week" | "month" | "all";

export type LedgerKind = LedgerEntryType | "other";

export type OccurrenceStatus = {
  completed: number; // net completions (completions - undos), never below 0
  skipped: boolean;
  completeCount: number; // raw number of completion entries
  undoCount: number; // raw number of undo entries
  lastAt: number; // last activity timestamp
};

export function startOfLocalDayMs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Monday as start of week (Sweden standard)
export function startOfLocalWeekMs(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const daysSinceMonday = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

export function startOfLocalMonthMs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

/**
 * Returns [startMs, endMs) for filtering ledger entries by createdAt.
 * endMs is "now" by default (good enough for live views).
 */
export function getRangeMs(
  range: RangeKey,
  nowMs: number = Date.now(),
): { startMs: number; endMs: number } {
  if (range === "all") return { startMs: 0, endMs: nowMs + 1 };

  if (range === "week") {
    return { startMs: startOfLocalWeekMs(nowMs), endMs: nowMs + 1 };
  }

  // "month"
  return { startMs: startOfLocalMonthMs(nowMs), endMs: nowMs + 1 };
}

/**
 * What an entry means. Newer entries carry `type`; older ones are recognised
 * by their `reason` prefix, so both old and new data keep working.
 */
export function entryKind(e: PointsLedgerEntry): LedgerKind {
  if (e.type === "complete" || e.type === "skip" || e.type === "undo") {
    return e.type;
  }
  const reason = String(e.reason ?? "");
  const delta = Number(e.delta ?? 0);
  if (reason.startsWith("Completed:") && delta > 0) return "complete";
  if (reason.startsWith("Skipped:")) return "skip";
  if (reason.startsWith("Undo:") && delta < 0) return "undo";
  return "other";
}

/** Chore title without the "Completed: " / "Skipped: " / "Undo: " prefix. */
export function entryTitle(e: PointsLedgerEntry): string {
  return String(e.reason ?? "").replace(/^(Completed|Skipped|Undo):\s*/, "");
}

export function occurrenceKey(templateId: string, dayKey: string): string {
  return `${templateId}__${dayKey}`;
}

/** The occurrence an entry belongs to, falling back to the local day it was created. */
export function entryOccurrenceKey(e: PointsLedgerEntry): string | null {
  if (!e.templateId) return null;
  const dayKey = e.dayKey || dayKeyFromTs(Number(e.createdAt ?? 0));
  return occurrenceKey(e.templateId, dayKey);
}

/**
 * Builds net status per occurrence key: `${templateId}__${dayKey}`.
 * Order-independent: completions minus undos, clamped at 0.
 */
export function buildStatusByOccurrence(
  ledger: PointsLedgerEntry[],
): Map<string, OccurrenceStatus> {
  const map = new Map<string, OccurrenceStatus>();

  for (const e of ledger) {
    const key = entryOccurrenceKey(e);
    if (!key) continue;

    const kind = entryKind(e);
    if (kind === "other") continue;

    const cur = map.get(key) ?? {
      completed: 0,
      skipped: false,
      completeCount: 0,
      undoCount: 0,
      lastAt: 0,
    };

    const createdAt = Number(e.createdAt ?? 0);
    if (createdAt > cur.lastAt) cur.lastAt = createdAt;

    if (kind === "complete") cur.completeCount += 1;
    else if (kind === "undo") cur.undoCount += 1;
    else if (kind === "skip") cur.skipped = true;

    cur.completed = Math.max(0, cur.completeCount - cur.undoCount);
    map.set(key, cur);
  }

  return map;
}

/** True when an occurrence still needs doing (not completed, not skipped). */
export function isOccurrenceOpen(st: OccurrenceStatus | undefined): boolean {
  if (!st) return true;
  if (st.skipped) return false;
  return st.completed <= 0;
}

export function isOccurrenceDone(st: OccurrenceStatus | undefined): boolean {
  return !!st && !st.skipped && st.completed > 0;
}

/**
 * Pairs every undo with the completion it cancels and returns the IDs of the
 * cancelled completions.
 *
 * - New undo entries name their target (`targetEntryId`).
 * - Older ones cancel the most recent earlier completion of the same occurrence.
 */
export function findUndoneCompletionIds(
  ledger: PointsLedgerEntry[],
): Set<string> {
  const undone = new Set<string>();
  const sorted = [...ledger].sort(
    (a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0),
  );

  const openByKey = new Map<string, PointsLedgerEntry[]>();

  for (const e of sorted) {
    const kind = entryKind(e);
    const key = entryOccurrenceKey(e);
    if (!key) continue;

    if (kind === "complete") {
      const list = openByKey.get(key) ?? [];
      list.push(e);
      openByKey.set(key, list);
      continue;
    }

    if (kind !== "undo") continue;

    const list = openByKey.get(key) ?? [];
    let idx = -1;
    if (e.targetEntryId) idx = list.findIndex((c) => c.id === e.targetEntryId);
    if (idx === -1) idx = list.length - 1;
    if (idx < 0) continue;

    undone.add(list[idx].id);
    list.splice(idx, 1);
  }

  return undone;
}

/** Completion entries that were never undone; these are what score points. */
export function survivingCompletions(
  ledger: PointsLedgerEntry[],
): PointsLedgerEntry[] {
  const undone = findUndoneCompletionIds(ledger);
  return ledger.filter((e) => entryKind(e) === "complete" && !undone.has(e.id));
}
