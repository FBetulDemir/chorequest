import { describe, expect, it } from "vitest";
import type { PointsLedgerEntry } from "@/src/lib/types";
import { badgesFor } from "@/src/lib/badges";

let seq = 0;
function done(day: number, hour = 12, title = "Dishes", uid = "a", delta = 10): PointsLedgerEntry {
  seq += 1;
  return {
    id: `c${seq}`,
    actorUid: uid,
    delta,
    reason: `Completed: ${title}`,
    createdAt: new Date(2026, 9, day, hour).getTime(),
    templateId: `t-${title}`,
    dayKey: `2026-10-${String(day).padStart(2, "0")}-${seq}`,
  };
}

const byId = (ledger: PointsLedgerEntry[], uid = "a") =>
  Object.fromEntries(badgesFor(ledger, uid).map((b) => [b.id, b]));

describe("badgesFor", () => {
  it("awards the first chore and tracks progress", () => {
    const b = byId([done(1)]);
    expect(b.first.earned).toBe(true);
    expect(b.chores10.earned).toBe(false);
    expect(b.chores10.progress).toBe(1);
  });

  it("uses the best streak, even if it has ended", () => {
    // 1-2-3 in a row, gap, then 10
    const b = byId([done(1), done(2), done(3), done(10)]);
    expect(b.streak3.earned).toBe(true);
    expect(b.streak7.progress).toBe(3);
  });

  it("counts early, late and weekend chores", () => {
    // 17 and 18 Oct 2026 are a weekend
    const early = Array.from({ length: 5 }, (_, i) => done(5 + i, 7));
    const b = byId([...early, done(17, 23), done(18, 23)]);
    expect(b.early.earned).toBe(true);
    expect(b.late.progress).toBe(2);
    expect(b.weekend.progress).toBe(2);
  });

  it("records when a badge was earned", () => {
    const ledger = [done(1), done(2, 12, "Trash")];
    const b = byId(ledger);
    expect(b.first.earnedAt).toBe(ledger[0].createdAt);
  });

  it("ignores other people's and undone completions", () => {
    const mine = done(1);
    const undo: PointsLedgerEntry = {
      id: "u1",
      actorUid: "b",
      delta: -10,
      reason: "Undo: Dishes",
      createdAt: mine.createdAt + 1000,
      templateId: mine.templateId,
      dayKey: mine.dayKey,
    };
    const b = byId([mine, undo, done(2, 12, "Dishes", "b")]);
    expect(b.first.earned).toBe(false);
  });
});
