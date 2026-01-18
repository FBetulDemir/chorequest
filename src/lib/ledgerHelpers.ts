// src/lib/ledgerHelpers.ts
import type { PointsLedgerEntry } from "@/src/types";

export function startOfDayMs(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMs(ts: number) {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export type RangeKey = "week" | "month" | "all";

export function getRangeMs(range: RangeKey) {
  const now = new Date();

  if (range === "all") {
    return { startMs: 0, endMs: Date.now() + 1 };
  }

  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }

  // week (Mon-Sun)
  const day = now.getDay(); // 0 Sun ... 6 Sat
  const diffToMon = (day + 6) % 7; // Mon=0
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMon);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function occurrenceKey(templateId: string, dayKey: string) {
  return `${templateId}__${dayKey}`;
}

/**
 * Status per occurrence (templateId + dayKey), derived from ledger.
 * - completed: net completions count (>0 means completed)
 * - skipped: if any "Skipped:" entry exists for that occurrence
 *
 * NOTE: This intentionally allows you to "complete next3 day chores today".
 * That will count in "points earned today" (by createdAt) but still marks the
 * target occurrence dayKey as completed.
 */
export function buildStatusByOccurrence(ledger: PointsLedgerEntry[]) {
  const map = new Map<string, { completed: number; skipped: boolean }>();

  for (const e of ledger) {
    if (!e.templateId || !e.dayKey) continue;
    const k = occurrenceKey(e.templateId, e.dayKey);
    const cur = map.get(k) ?? { completed: 0, skipped: false };

    const reason = String(e.reason ?? "");
    const delta = Number(e.delta ?? 0);

    if (reason.startsWith("Completed:") && delta > 0) cur.completed += 1;
    if (reason.startsWith("Undo:") && delta < 0) cur.completed -= 1;
    if (reason.startsWith("Skipped:")) cur.skipped = true;

    map.set(k, cur);
  }

  return map;
}

export function isOccurrenceCompleted(
  status: Map<string, { completed: number; skipped: boolean }>,
  templateId: string,
  dayKey: string,
) {
  const st = status.get(occurrenceKey(templateId, dayKey));
  return Boolean(st && st.completed > 0);
}

export function isOccurrenceSkipped(
  status: Map<string, { completed: number; skipped: boolean }>,
  templateId: string,
  dayKey: string,
) {
  const st = status.get(occurrenceKey(templateId, dayKey));
  return Boolean(st && st.skipped);
}

/** Entries completed within [startMs, endMs) by createdAt (what you did in that time window). */
export function completedEntriesInTimeRange(
  ledger: PointsLedgerEntry[],
  startMs: number,
  endMs: number,
) {
  return ledger.filter((e) => {
    const t = Number(e.createdAt ?? 0);
    if (!(t >= startMs && t < endMs)) return false;
    const reason = String(e.reason ?? "");
    const delta = Number(e.delta ?? 0);
    return reason.startsWith("Completed:") && delta > 0;
  });
}

export function pointsFromEntries(entries: PointsLedgerEntry[]) {
  return entries.reduce((s, e) => s + Number(e.delta ?? 0), 0);
}
