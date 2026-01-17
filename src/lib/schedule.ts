import type { ChoreTemplate, Frequency } from "@/src/types";

export type Occurrence = {
  templateId: string;
  chore: ChoreTemplate;
  dueAt: number; // start of day timestamp
  dayKey: string; // YYYY-MM-DD
  bucket: "today" | "next3" | "later";
};

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKeyFromTs(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(ts: number, days: number) {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekDayOf(ts: number) {
  return new Date(ts).getDay(); // 0..6
}

function monthDayOf(ts: number) {
  return new Date(ts).getDate(); // 1..31
}

function clampDay28(n: number) {
  if (n < 1) return 1;
  if (n > 28) return 28;
  return n;
}

function defaultWeekDay(template: ChoreTemplate) {
  return template.schedule?.weekDay ?? weekDayOf(template.createdAt);
}

function defaultMonthDay(template: ChoreTemplate) {
  return (
    template.schedule?.monthDay ?? clampDay28(monthDayOf(template.createdAt))
  );
}

function seasonalAnchor(template: ChoreTemplate) {
  const created = new Date(template.createdAt);
  const month = template.schedule?.seasonalMonth ?? created.getMonth() + 1; // 1..12
  const day = template.schedule?.seasonalDay ?? clampDay28(created.getDate());
  return { month, day };
}

function isDueOnDay(template: ChoreTemplate, dayStart: number) {
  const freq: Frequency = template.frequency;

  if (freq === "daily") return true;

  if (freq === "weekly") {
    const wd = defaultWeekDay(template);
    return weekDayOf(dayStart) === wd;
  }

  if (freq === "monthly") {
    const md = defaultMonthDay(template);
    return clampDay28(monthDayOf(dayStart)) === md;
  }

  if (freq === "seasonal") {
    const { month, day } = seasonalAnchor(template);
    const d = new Date(dayStart);
    return (
      d.getMonth() + 1 === month && clampDay28(d.getDate()) === clampDay28(day)
    );
  }

  return false;
}

export function buildOccurrences(
  templates: ChoreTemplate[],
  fromTs: number,
  daysForward: number,
): Occurrence[] {
  const fromDay = startOfDay(fromTs);
  const out: Occurrence[] = [];

  for (let i = 0; i <= daysForward; i++) {
    const day = addDays(fromDay, i);
    const dk = dayKeyFromTs(day);

    for (const t of templates) {
      if (!t.active) continue;
      if (isDueOnDay(t, day)) {
        const bucket: Occurrence["bucket"] =
          i === 0 ? "today" : i <= 3 ? "next3" : "later";

        out.push({
          templateId: t.id,
          chore: t,
          dueAt: day,
          dayKey: dk,
          bucket,
        });
      }
    }
  }

  return out;
}
