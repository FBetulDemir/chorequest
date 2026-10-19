// src/lib/dates.ts
// English labels everywhere until the app is localized (roadmap §5.9).
const LOCALE = "en-GB";

const DAY_MS = 86_400_000;

/** Local midnight for a "YYYY-MM-DD" key. */
export function dayKeyToMs(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Whole local days from `fromStartMs` (a local midnight) to the day of `dayKey`. */
export function daysFrom(fromStartMs: number, dayKey: string): number {
  // Round, because DST days are 23 or 25 hours long
  return Math.round((dayKeyToMs(dayKey) - fromStartMs) / DAY_MS);
}

/** "Today", "Tomorrow", "Yesterday", "Thu 23 Oct". */
export function friendlyDay(dayKey: string, todayStartMs: number): string {
  const diff = daysFrom(todayStartMs, dayKey);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = new Date(dayKeyToMs(dayKey));
  const sameYear = d.getFullYear() === new Date(todayStartMs).getFullYear();
  return d.toLocaleDateString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "Monday, 19 October". */
export function longDate(ms: number): string {
  return new Date(ms).toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

/** "just now", "5 min ago", "3 h ago", "Yesterday, 14:05", "12 Oct, 09:30". */
export function timeAgo(ms: number, nowMs: number = Date.now()): string {
  const diff = nowMs - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;

  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  if (ms >= todayStart.getTime()) return `${Math.floor(diff / 3_600_000)} h ago`;

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  if (ms >= yesterdayStart.getTime()) return `Yesterday, ${timeOfDay(ms)}`;

  const d = new Date(ms);
  const sameYear = d.getFullYear() === todayStart.getFullYear();
  const date = d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${date}, ${timeOfDay(ms)}`;
}

export function greeting(ms: number = Date.now()): string {
  const h = new Date(ms).getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
