// src/lib/ledgerHelpers.ts
import type { PointsLedgerEntry } from "@/src/lib/types";

export type RangeKey = "week" | "month" | "all";

export type OccurrenceStatus = {
  completed: number; // net completion count
  skipped: boolean;
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
  if (range === "all") return { startMs: 0, endMs: nowMs };

  if (range === "week") {
    return { startMs: startOfLocalWeekMs(nowMs), endMs: nowMs };
  }

  // "month"
  return { startMs: startOfLocalMonthMs(nowMs), endMs: nowMs };
}

/**
 * Builds net status per occurrence key: `${templateId}__${dayKey}`
 *
 * Rules:
 * - "Completed:" with delta > 0 increments completed
 * - "Undo:" with delta < 0 decrements completed
 * - "Skipped:" sets skipped=true
 * - completed is clamped to >= 0
 */
export function buildStatusByOccurrence(
  ledger: PointsLedgerEntry[],
): Map<string, OccurrenceStatus> {
  const map = new Map<string, OccurrenceStatus>();

  for (const e of ledger) {
    const templateId = (e as any).templateId;
    const dayKey = (e as any).dayKey;
    if (!templateId || !dayKey) continue;

    const key = `${templateId}__${dayKey}`;
    const cur =
      map.get(key) ??
      ({
        completed: 0,
        skipped: false,
        lastAt: 0,
      } as OccurrenceStatus);

    const reason = String((e as any).reason ?? "");
    const delta = Number((e as any).delta ?? 0);
    const createdAt = Number((e as any).createdAt ?? 0);

    if (createdAt > cur.lastAt) cur.lastAt = createdAt;

    if (reason.startsWith("Completed:") && delta > 0) {
      cur.completed += 1;
    } else if (reason.startsWith("Undo:") && delta < 0) {
      cur.completed -= 1;
    } else if (reason.startsWith("Skipped:")) {
      cur.skipped = true;
    }

    if (cur.completed < 0) cur.completed = 0;

    map.set(key, cur);
  }

  return map;
}
