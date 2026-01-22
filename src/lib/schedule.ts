// src/lib/schedule.ts
import type { ChoreTemplate } from "@/src/lib/types";

export type OccurrenceBucket = "today" | "next3" | "upcoming";

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

function templateIdOf(t: any): string {
  return String(t?.id ?? t?.templateId ?? "");
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

    const freq = normalizeFreq((t as any).frequency);

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

    if (freq === "weekly") {
      for (let i = 0; i <= horizonDays; i += 7) {
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

    if (freq === "monthly") {
      let m = 0;
      while (true) {
        const dateMs = addMonthsLocal(base, m);
        const diffDays = Math.round((dateMs - base) / 86400000);
        if (diffDays > horizonDays) break;

        out.push({
          templateId: tid,
          dateMs,
          dayKey: dayKeyFromTs(dateMs),
          bucket: bucketForIndex(diffDays),
          chore: t,
        });

        m += 1;
        if (m > 60) break;
      }
      continue;
    }

    // seasonal: every ~90 days
    for (let i = 0; i <= horizonDays; i += 90) {
      const dateMs = addDaysLocal(base, i);
      out.push({
        templateId: tid,
        dateMs,
        dayKey: dayKeyFromTs(dateMs),
        bucket: bucketForIndex(i),
        chore: t,
      });
    }
  }

  out.sort((a, b) => a.dateMs - b.dateMs);
  return out;
}
