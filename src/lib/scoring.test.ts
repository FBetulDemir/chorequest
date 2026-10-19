import { describe, expect, it } from "vitest";
import type { PointsLedgerEntry } from "@/src/lib/types";
import { scoresByMonth, scoresInRange, streakFor } from "@/src/lib/scoring";

const at = (month: number, day: number, hour = 10) =>
  new Date(2026, month - 1, day, hour).getTime();

let seq = 0;
function done(actorUid: string, createdAt: number, delta = 10, title = "Dishes"): PointsLedgerEntry {
  seq += 1;
  return {
    id: `c${seq}`,
    actorUid,
    delta,
    reason: `Completed: ${title}`,
    createdAt,
    templateId: `t-${title}`,
    dayKey: `d${seq}`, // each completion is its own occurrence
  };
}

describe("scoresInRange", () => {
  it("sums points and chores per member inside the range", () => {
    const ledger = [
      done("a", at(10, 1), 20),
      done("a", at(10, 2), 10),
      done("b", at(10, 2), 30),
      done("a", at(9, 30), 99), // outside
    ];
    const scores = scoresInRange(ledger, at(10, 1, 0), at(11, 1, 0));
    expect(scores.get("a")).toMatchObject({ points: 30, chores: 2 });
    expect(scores.get("b")).toMatchObject({ points: 30, chores: 1 });
  });

  it("takes undone points from the person who earned them, not the one who pressed undo", () => {
    const c = done("a", at(10, 1), 20);
    const u: PointsLedgerEntry = {
      id: "u1",
      actorUid: "b", // partner pressed undo
      delta: -20,
      reason: "Undo: Dishes",
      createdAt: at(10, 1, 12),
      templateId: c.templateId,
      dayKey: c.dayKey,
    };
    const scores = scoresInRange([c, u], 0, at(12, 1));
    expect(scores.get("a")).toBeUndefined();
    expect(scores.get("b")).toBeUndefined();
  });

  it("reports the most frequent chore", () => {
    const ledger = [
      done("a", at(10, 1), 10, "Dishes"),
      done("a", at(10, 2), 10, "Trash"),
      done("a", at(10, 3), 10, "Trash"),
    ];
    expect(scoresInRange(ledger, 0, at(12, 1)).get("a")?.topChore).toBe("Trash");
  });
});

describe("streakFor", () => {
  const now = at(10, 19, 20);

  it("counts consecutive local days ending today", () => {
    const ledger = [done("a", at(10, 19)), done("a", at(10, 18)), done("a", at(10, 17)), done("a", at(10, 15))];
    expect(streakFor(ledger, "a", now)).toBe(3);
  });

  it("keeps the streak alive if nothing is done yet today", () => {
    const ledger = [done("a", at(10, 18)), done("a", at(10, 17))];
    expect(streakFor(ledger, "a", now)).toBe(2);
  });

  it("uses local days, so a late-night completion counts for that day", () => {
    // 23:30 local belongs to the 18th even in timezones ahead of UTC
    const ledger = [done("a", at(10, 19, 8)), done("a", at(10, 18, 23))];
    expect(streakFor(ledger, "a", now)).toBe(2);
  });

  it("is zero with no completions", () => {
    expect(streakFor([], "a", now)).toBe(0);
  });
});

describe("scoresByMonth", () => {
  it("groups by month, newest first", () => {
    const ledger = [done("a", at(9, 5), 10), done("b", at(10, 5), 20), done("a", at(10, 6), 5)];
    const months = scoresByMonth(ledger);
    expect(months.map((m) => m.key)).toEqual(["2026-10", "2026-09"]);
    expect(months[0]).toMatchObject({ totalPoints: 25, totalChores: 2 });
    expect(months[0].members.map((m) => m.uid)).toEqual(["b", "a"]);
  });
});
