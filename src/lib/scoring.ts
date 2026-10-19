// src/lib/scoring.ts
import type { PointsLedgerEntry } from "@/src/lib/types";
import { entryTitle, survivingCompletions } from "@/src/lib/ledgerHelpers";
import { dayKeyFromTs } from "@/src/lib/schedule";

export type MemberScore = {
  uid: string;
  points: number;
  chores: number;
  topChore: string | null;
};

export type MonthScore = {
  key: string; // "2026-07"
  totalPoints: number;
  totalChores: number;
  members: MemberScore[]; // sorted by points, highest first
};

function tally(completions: PointsLedgerEntry[]): Map<string, MemberScore> {
  const byUid = new Map<string, MemberScore & { counts: Map<string, number> }>();

  for (const e of completions) {
    const uid = String(e.actorUid ?? "");
    const cur = byUid.get(uid) ?? {
      uid,
      points: 0,
      chores: 0,
      topChore: null,
      counts: new Map<string, number>(),
    };
    cur.points += Number(e.delta ?? 0);
    cur.chores += 1;
    const title = entryTitle(e);
    cur.counts.set(title, (cur.counts.get(title) ?? 0) + 1);
    byUid.set(uid, cur);
  }

  const out = new Map<string, MemberScore>();
  for (const [uid, v] of byUid) {
    let topChore: string | null = null;
    let best = 0;
    for (const [title, count] of v.counts) {
      if (count > best) {
        best = count;
        topChore = title;
      }
    }
    out.set(uid, { uid, points: v.points, chores: v.chores, topChore });
  }
  return out;
}

/** Points and chore counts per member for completions created in [startMs, endMs). */
export function scoresInRange(
  ledger: PointsLedgerEntry[],
  startMs: number,
  endMs: number,
): Map<string, MemberScore> {
  const inRange = survivingCompletions(ledger).filter((e) => {
    const t = Number(e.createdAt ?? 0);
    return t >= startMs && t < endMs;
  });
  return tally(inRange);
}

/**
 * Consecutive local days (ending today, or yesterday if nothing yet today)
 * on which the member completed at least one chore.
 */
export function streakFor(
  ledger: PointsLedgerEntry[],
  uid: string,
  nowMs: number = Date.now(),
): number {
  const days = new Set<string>();
  for (const e of survivingCompletions(ledger)) {
    if (e.actorUid === uid) days.add(dayKeyFromTs(Number(e.createdAt ?? 0)));
  }
  if (days.size === 0) return 0;

  const cursor = new Date(nowMs);
  cursor.setHours(12, 0, 0, 0); // noon avoids DST edge cases

  if (!days.has(dayKeyFromTs(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(dayKeyFromTs(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Per-month leaderboards, newest month first. */
export function scoresByMonth(ledger: PointsLedgerEntry[]): MonthScore[] {
  const byMonth = new Map<string, PointsLedgerEntry[]>();

  for (const e of survivingCompletions(ledger)) {
    const t = Number(e.createdAt ?? 0);
    if (!t) continue;
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push(e);
    byMonth.set(key, list);
  }

  const months: MonthScore[] = [];
  for (const [key, entries] of byMonth) {
    const members = [...tally(entries).values()].sort(
      (a, b) => b.points - a.points,
    );
    months.push({
      key,
      totalPoints: members.reduce((s, m) => s + m.points, 0),
      totalChores: members.reduce((s, m) => s + m.chores, 0),
      members,
    });
  }

  months.sort((a, b) => (a.key < b.key ? 1 : -1));
  return months;
}
