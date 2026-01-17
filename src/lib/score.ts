import { listLedgerEntries } from "@/src/lib/points";
import type { PointsLedgerEntry } from "@/src/types";

export type ScoreRow = {
  uid: string;
  name: string;
  points: number;
  chores: number;
};

export type RangeKey = "week" | "month" | "all";

export function rangeLabel(k: RangeKey) {
  if (k === "week") return "This Week";
  if (k === "month") return "This Month";
  return "All Time";
}

function startOfWeekMs(now = Date.now()) {
  // Monday start
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

function startOfMonthMs(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

function rangeStartMs(k: RangeKey) {
  if (k === "week") return startOfWeekMs();
  if (k === "month") return startOfMonthMs();
  return 0;
}

function isCompletionEntry(e: PointsLedgerEntry) {
  // your Today page uses delta > 0 and reason starts with "Completed:"
  return Number(e.delta) > 0 && String(e.reason ?? "").startsWith("Completed:");
}

export async function computeLeaderboardFromLedger(params: {
  householdId: string;
  members: { uid: string; name: string }[];
  range: RangeKey;
  limit?: number;
}): Promise<ScoreRow[]> {
  const { householdId, members, range } = params;
  const lim = params.limit ?? 2000;

  const since = rangeStartMs(range);

  const entries = await listLedgerEntries(householdId, lim);

  const totals = new Map<string, { points: number; chores: number }>();

  for (const e of entries) {
    if (!isCompletionEntry(e)) continue;

    const t = Number(e.createdAt ?? 0);
    if (since > 0 && t > 0 && t < since) continue;

    const u = String(e.actorUid ?? "");
    if (!u) continue;

    const pts = Number(e.delta ?? 0);
    const prev = totals.get(u) ?? { points: 0, chores: 0 };
    totals.set(u, { points: prev.points + pts, chores: prev.chores + 1 });
  }

  // ensure everyone appears
  const rows: ScoreRow[] = members.map((m) => {
    const t = totals.get(m.uid);
    return {
      uid: m.uid,
      name: m.name || "Member",
      points: t?.points ?? 0,
      chores: t?.chores ?? 0,
    };
  });

  rows.sort((a, b) => b.points - a.points);
  return rows;
}
