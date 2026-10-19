// src/lib/badges.ts
// Achievements worked out from the ledger. Nothing extra is stored.
import type { PointsLedgerEntry } from "@/src/lib/types";
import { entryTitle, survivingCompletions } from "@/src/lib/ledgerHelpers";
import { dayKeyFromTs } from "@/src/lib/schedule";

export type Badge = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  target: number;
  progress: number; // capped at target
  earned: boolean;
  earnedAt: number | null; // when the threshold was reached
};

type Definition = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  target: number;
  /** Running value after each completion (oldest first) */
  measure: "chores" | "points" | "streak" | "early" | "late" | "weekend" | "variety";
};

const DEFINITIONS: Definition[] = [
  { id: "first", emoji: "🌱", title: "First step", description: "Complete your first chore", target: 1, measure: "chores" },
  { id: "chores10", emoji: "🧹", title: "Getting the hang of it", description: "Complete 10 chores", target: 10, measure: "chores" },
  { id: "chores50", emoji: "🦸", title: "Household hero", description: "Complete 50 chores", target: 50, measure: "chores" },
  { id: "chores100", emoji: "🏆", title: "Chore champion", description: "Complete 100 chores", target: 100, measure: "chores" },
  { id: "streak3", emoji: "🔥", title: "On fire", description: "Do chores 3 days in a row", target: 3, measure: "streak" },
  { id: "streak7", emoji: "📅", title: "Week warrior", description: "Do chores 7 days in a row", target: 7, measure: "streak" },
  { id: "streak30", emoji: "💎", title: "Unstoppable", description: "Do chores 30 days in a row", target: 30, measure: "streak" },
  { id: "early", emoji: "🌅", title: "Early bird", description: "Finish 5 chores before 8:00", target: 5, measure: "early" },
  { id: "late", emoji: "🦉", title: "Night owl", description: "Finish 5 chores after 22:00", target: 5, measure: "late" },
  { id: "weekend", emoji: "🛋️", title: "Weekend warrior", description: "Finish 10 chores on weekends", target: 10, measure: "weekend" },
  { id: "variety", emoji: "🎨", title: "Jack of all trades", description: "Complete 10 different chores", target: 10, measure: "variety" },
  { id: "points1000", emoji: "🪙", title: "Big earner", description: "Earn 1,000 points", target: 1000, measure: "points" },
];

export function badgesFor(ledger: PointsLedgerEntry[], uid: string): Badge[] {
  const mine = survivingCompletions(ledger)
    .filter((e) => e.actorUid === uid)
    .sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0));

  const values = { chores: 0, points: 0, streak: 0, early: 0, late: 0, weekend: 0, variety: 0 };
  const best = { ...values }; // streak is the best run so far
  const earnedAt = new Map<string, number>();
  const titles = new Set<string>();
  let lastDay: string | null = null;
  let run = 0;

  for (const e of mine) {
    const t = Number(e.createdAt ?? 0);
    const d = new Date(t);
    const day = dayKeyFromTs(t);

    values.chores += 1;
    values.points += Number(e.delta ?? 0);
    if (d.getHours() < 8) values.early += 1;
    if (d.getHours() >= 22) values.late += 1;
    if (d.getDay() === 0 || d.getDay() === 6) values.weekend += 1;
    titles.add(entryTitle(e));
    values.variety = titles.size;

    // Consecutive local days
    if (day !== lastDay) {
      if (lastDay) {
        const prev = new Date(`${lastDay}T12:00:00`);
        prev.setDate(prev.getDate() + 1);
        run = dayKeyFromTs(prev.getTime()) === day ? run + 1 : 1;
      } else {
        run = 1;
      }
      lastDay = day;
    }
    values.streak = run;

    for (const key of Object.keys(best) as (keyof typeof best)[]) {
      best[key] = Math.max(best[key], values[key]);
    }
    for (const def of DEFINITIONS) {
      if (!earnedAt.has(def.id) && best[def.measure] >= def.target) earnedAt.set(def.id, t);
    }
  }

  return DEFINITIONS.map((def) => ({
    id: def.id,
    emoji: def.emoji,
    title: def.title,
    description: def.description,
    target: def.target,
    progress: Math.min(def.target, best[def.measure]),
    earned: earnedAt.has(def.id),
    earnedAt: earnedAt.get(def.id) ?? null,
  }));
}
