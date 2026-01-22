// src/lib/ledgerHelpers.ts

// A small helper set for ledger math.
// No imports on purpose, so it works no matter where your types live.

export type RangeKey =
  | "today"
  | "thisWeek"
  | "thisMonth"
  | "allTime"
  | "week"
  | "month"
  | "all";

export function getRangeMs(
  range: RangeKey,
  nowMs: number = Date.now(),
): { startMs: number; endMs: number } {
  const endMs = nowMs;

  // normalize aliases
  const r: RangeKey =
    range === "week"
      ? "thisWeek"
      : range === "month"
        ? "thisMonth"
        : range === "all"
          ? "allTime"
          : range;

  if (r === "allTime") return { startMs: 0, endMs };

  const d = new Date(nowMs);

  if (r === "today") {
    const start = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    return { startMs: start, endMs };
  }

  if (r === "thisWeek") {
    // Monday start (Sweden-style)
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const mondayOffset = (day + 6) % 7; // Mon=0 ... Sun=6
    const start = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() - mondayOffset,
    ).getTime();
    return { startMs: start, endMs };
  }

  // thisMonth
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return { startMs: start, endMs };
}

// For Today/Plan pages: compute net completion and skipped state per occurrence key.
// Key format expected elsewhere: `${templateId}__${dayKey}`
export function buildStatusByOccurrence(
  ledger: Array<{
    templateId?: string;
    dayKey?: string;
    reason?: unknown;
    delta?: unknown;
  }>,
): Map<string, { completed: number; skipped: boolean }> {
  const map = new Map<string, { completed: number; skipped: boolean }>();

  for (const e of ledger || []) {
    const templateId = e.templateId ? String(e.templateId) : "";
    const dayKey = e.dayKey ? String(e.dayKey) : "";
    if (!templateId || !dayKey) continue;

    const key = `${templateId}__${dayKey}`;
    const cur = map.get(key) ?? { completed: 0, skipped: false };

    const r = String(e.reason ?? "");
    const delta = Number(e.delta ?? 0);

    if (r.startsWith("Completed:") && delta > 0) cur.completed += 1;
    if (r.startsWith("Undo:") && delta < 0) cur.completed -= 1;
    if (r.startsWith("Skipped:")) cur.skipped = true;

    map.set(key, cur);
  }

  return map;
}
