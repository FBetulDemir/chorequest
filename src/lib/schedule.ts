// src/lib/schedule.ts
import type { ChoreTemplate } from "@/src/lib/types";

export type OccurrenceBucket = "overdue" | "today" | "next3" | "upcoming";

export type Occurrence = {
  templateId: string;
  dayKey: string; // YYYY-MM-DD (local)
  dateMs: number; // local midnight timestamp
  bucket: OccurrenceBucket;
  chore: ChoreTemplate;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Local day key (NOT UTC)
export function dayKeyFromTs(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

// Exported because Today page imports it
export function startOfLocalDayMs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDaysLocal(dayStartMs: number, days: number): number {
  const d = new Date(dayStartMs);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addMonthsLocal(dayStartMs: number, months: number): number {
  const d = new Date(dayStartMs);
  const dayOfMonth = d.getDate();
  d.setMonth(d.getMonth() + months);

  // If the target month has fewer days, JS may roll forward
  if (d.getDate() !== dayOfMonth) {
    d.setDate(0);
  }

  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function normalizeFreq(
  freq: unknown,
): "daily" | "weekly" | "monthly" | "seasonal" {
  const f = String(freq ?? "").toLowerCase();
  if (f === "daily" || f === "weekly" || f === "monthly" || f === "seasonal") {
    return f;
  }
  return "weekly";
}

function templateIdOf(t: ChoreTemplate): string {
  return String(t?.id ?? "");
}

function bucketForIndex(i: number): OccurrenceBucket {
  if (i === 0) return "today";
  if (i >= 1 && i <= 3) return "next3";
  return "upcoming";
}

export function buildOccurrences(
  templates: ChoreTemplate[],
  nowMs: number,
  horizonDays: number,
): Occurrence[] {
  const base = startOfLocalDayMs(nowMs);
  const out: Occurrence[] = [];

  for (const t of templates) {
    const tid = templateIdOf(t);
    if (!tid) continue;

    const freq = normalizeFreq(t.frequency);

    if (freq === "daily") {
      for (let i = 0; i <= horizonDays; i++) {
        const dateMs = addDaysLocal(base, i);
        out.push({
          templateId: tid,
          dateMs,
          dayKey: dayKeyFromTs(dateMs),
          bucket: bucketForIndex(i),
          chore: t,
        });
      }
      continue;
    }

    // For non-daily chores, anchor to the chore's createdAt date
    const anchor = startOfLocalDayMs(Number(t.createdAt ?? nowMs));

    if (freq === "weekly") {
      // Generate occurrences every 7 days from anchor
      let weekCount = 0;
      while (true) {
        const dateMs = addDaysLocal(anchor, weekCount * 7);
        const diffDays = Math.round((dateMs - base) / 86400000);

        // Stop if we've gone beyond the horizon
        if (diffDays > horizonDays) break;

        // Only include if this occurrence is today or in the future
        if (diffDays >= 0) {
          out.push({
            templateId: tid,
            dateMs,
            dayKey: dayKeyFromTs(dateMs),
            bucket: bucketForIndex(diffDays),
            chore: t,
          });
        }

        weekCount += 1;
        if (weekCount > 52) break; // Safety limit: 1 year
      }
      continue;
    }

    if (freq === "monthly") {
      // Generate occurrences monthly from anchor
      let m = 0;
      while (true) {
        const dateMs = addMonthsLocal(anchor, m);
        const diffDays = Math.round((dateMs - base) / 86400000);

        // Stop if we've gone beyond the horizon
        if (diffDays > horizonDays) break;

        // Only include if this occurrence is today or in the future
        if (diffDays >= 0) {
          out.push({
            templateId: tid,
            dateMs,
            dayKey: dayKeyFromTs(dateMs),
            bucket: bucketForIndex(diffDays),
            chore: t,
          });
        }

        m += 1;
        if (m > 60) break;
      }
      continue;
    }

    // seasonal: every ~90 days from anchor
    let seasonCount = 0;
    while (true) {
      const dateMs = addDaysLocal(anchor, seasonCount * 90);
      const diffDays = Math.round((dateMs - base) / 86400000);

      // Stop if we've gone beyond the horizon
      if (diffDays > horizonDays) break;

      // Only include if this occurrence is today or in the future
      if (diffDays >= 0) {
        out.push({
          templateId: tid,
          dateMs,
          dayKey: dayKeyFromTs(dateMs),
          bucket: bucketForIndex(diffDays),
          chore: t,
        });
      }

      seasonCount += 1;
      if (seasonCount > 4) break; // Safety limit: ~1 year
    }
  }

  out.sort((a, b) => a.dateMs - b.dateMs);
  return out;
}

/**
 * The most recent missed occurrence of each weekly / monthly / seasonal chore,
 * within the last `lookbackDays` (today excluded). Daily chores are left out on
 * purpose: yesterday's dishes shouldn't pile up.
 *
 * Callers decide whether it is really overdue by checking the ledger.
 */
export function buildPastOccurrences(
  templates: ChoreTemplate[],
  nowMs: number,
  lookbackDays: number,
): Occurrence[] {
  const base = startOfLocalDayMs(nowMs);
  const out: Occurrence[] = [];

  for (const t of templates) {
    const tid = templateIdOf(t);
    if (!tid) continue;

    const freq = normalizeFreq(t.frequency);
    if (freq === "daily") continue;

    const anchor = startOfLocalDayMs(Number(t.createdAt ?? nowMs));
    const step = (i: number) =>
      freq === "weekly"
        ? addDaysLocal(anchor, i * 7)
        : freq === "monthly"
          ? addMonthsLocal(anchor, i)
          : addDaysLocal(anchor, i * 90);

    // Walk forward to the last occurrence before today
    let last: number | null = null;
    for (let i = 0; i < 2000; i++) {
      const dateMs = step(i);
      if (dateMs >= base) break;
      last = dateMs;
    }
    if (last === null) continue;

    const diffDays = Math.round((base - last) / 86400000);
    if (diffDays > lookbackDays) continue;

    out.push({
      templateId: tid,
      dateMs: last,
      dayKey: dayKeyFromTs(last),
      bucket: "overdue",
      chore: t,
    });
  }

  out.sort((a, b) => a.dateMs - b.dateMs);
  return out;
}
