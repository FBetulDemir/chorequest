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

const DAY_MS = 86_400_000;

/** Whole local days from a to b (both local midnights); rounding absorbs DST changes. */
function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / DAY_MS);
}

/** First day the schedule applies: creation, or the last time its day was changed. */
function anchorOf(t: ChoreTemplate, nowMs: number): number {
  const created = Number(t.createdAt ?? nowMs);
  const since = Number(t.schedule?.since ?? 0);
  return startOfLocalDayMs(Math.max(created, since));
}

/**
 * Every day (local midnight) in [fromMs, toMs] the chore is due.
 *
 * - daily: every day
 * - weekly: on `schedule.weekDay` (0 = Sunday), or every 7 days from the anchor
 * - monthly: on `schedule.monthDay` (1–28), or the anchor's day of the month
 * - seasonal: every 90 days from the anchor
 *
 * Nothing is due before the anchor.
 */
export function occurrencesInRange(t: ChoreTemplate, fromMs: number, toMs: number, nowMs = Date.now()): number[] {
  const anchor = anchorOf(t, nowMs);
  const from = Math.max(startOfLocalDayMs(fromMs), anchor);
  const to = startOfLocalDayMs(toMs);
  if (from > to) return [];

  const out: number[] = [];
  const freq = normalizeFreq(t.frequency);
  const weekDay = t.schedule?.weekDay;
  const monthDay = t.schedule?.monthDay;

  if (freq === "daily") {
    for (let d = from; d <= to; d = addDaysLocal(d, 1)) out.push(d);
    return out;
  }

  if (freq === "weekly" || freq === "seasonal") {
    const step = freq === "weekly" ? 7 : 90;
    // First due day on or after the anchor
    let first = anchor;
    if (freq === "weekly" && typeof weekDay === "number") {
      first = addDaysLocal(anchor, (weekDay - new Date(anchor).getDay() + 7) % 7);
    }
    // Jump straight to the window instead of walking from the anchor
    const skip = Math.max(0, Math.ceil(daysBetween(first, from) / step));
    for (let d = addDaysLocal(first, skip * step); d <= to; d = addDaysLocal(d, step)) {
      if (d >= from) out.push(d);
    }
    return out;
  }

  // monthly
  const a = new Date(anchor);
  const f = new Date(from);
  const startMonths = Math.max(0, (f.getFullYear() - a.getFullYear()) * 12 + (f.getMonth() - a.getMonth()) - 1);
  for (let m = startMonths; ; m++) {
    let d: number;
    if (typeof monthDay === "number") {
      const x = new Date(a.getFullYear(), a.getMonth() + m, Math.min(28, Math.max(1, monthDay)));
      d = x.getTime();
    } else {
      d = addMonthsLocal(anchor, m);
    }
    if (d > to) break;
    if (d >= from) out.push(d);
  }
  return out;
}

export function buildOccurrences(
  templates: ChoreTemplate[],
  nowMs: number,
  horizonDays: number,
): Occurrence[] {
  const base = startOfLocalDayMs(nowMs);
  const end = addDaysLocal(base, horizonDays);
  const out: Occurrence[] = [];

  for (const t of templates) {
    const tid = templateIdOf(t);
    if (!tid) continue;
    for (const dateMs of occurrencesInRange(t, base, end, nowMs)) {
      out.push({
        templateId: tid,
        dateMs,
        dayKey: dayKeyFromTs(dateMs),
        bucket: bucketForIndex(daysBetween(base, dateMs)),
        chore: t,
      });
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
    if (!tid || normalizeFreq(t.frequency) === "daily") continue;

    const past = occurrencesInRange(t, addDaysLocal(base, -lookbackDays), addDaysLocal(base, -1), nowMs);
    const last = past[past.length - 1];
    if (last === undefined) continue;

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

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** The weekday a weekly chore falls on (chosen, or the anchor's). */
export function effectiveWeekDay(t: ChoreTemplate, nowMs = Date.now()): number {
  return typeof t.schedule?.weekDay === "number" ? t.schedule.weekDay : new Date(anchorOf(t, nowMs)).getDay();
}

/** The day of the month a monthly chore falls on (chosen, or the anchor's, capped at 28). */
export function effectiveMonthDay(t: ChoreTemplate, nowMs = Date.now()): number {
  return typeof t.schedule?.monthDay === "number"
    ? t.schedule.monthDay
    : Math.min(28, new Date(anchorOf(t, nowMs)).getDate());
}

/** "Every day", "Every Saturday", "15th of each month", "Every 3 months". */
export function describeSchedule(t: ChoreTemplate, nowMs = Date.now()): string {
  switch (normalizeFreq(t.frequency)) {
    case "daily":
      return "Every day";
    case "weekly":
      return `Every ${WEEKDAY_NAMES[effectiveWeekDay(t, nowMs)]}`;
    case "monthly":
      return `${ordinal(effectiveMonthDay(t, nowMs))} of each month`;
    default:
      return "Every 3 months";
  }
}
