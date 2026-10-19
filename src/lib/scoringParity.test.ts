import { describe, expect, it } from "vitest";
import type { PointsLedgerEntry } from "@/src/lib/types";
import { scoresInRange } from "@/src/lib/scoring";
import { weeklyPoints } from "../../functions/src/scoring";

// The weekly-winner Cloud Function has its own copy of the scoring rules.
// This keeps it in step with the app.
describe("server scoring matches the app", () => {
  const t = (d: number, h = 10) => new Date(2026, 9, d, h).getTime();
  const base = { templateId: "dishes", reason: "Completed: Dishes" };
  const ledger: PointsLedgerEntry[] = [
    { id: "c1", actorUid: "a", delta: 20, createdAt: t(13), dayKey: "2026-10-13", ...base },
    { id: "c2", actorUid: "b", delta: 20, createdAt: t(14), dayKey: "2026-10-14", ...base },
    { id: "c3", actorUid: "a", delta: 30, createdAt: t(15), dayKey: "2026-10-15", ...base, type: "complete" },
    // b undoes a's completion from the 15th
    { id: "u1", actorUid: "b", delta: -30, createdAt: t(15, 12), dayKey: "2026-10-15", templateId: "dishes", reason: "Undo: Dishes" },
    { id: "c4", actorUid: "b", delta: 10, createdAt: t(16), dayKey: "2026-10-16", ...base },
    // before the window
    { id: "c0", actorUid: "a", delta: 99, createdAt: t(5), dayKey: "2026-10-05", ...base },
  ];

  it("gives the same totals", () => {
    const since = t(12, 0);
    const app = scoresInRange(ledger, since, t(20));
    const server = weeklyPoints(ledger, since);
    expect(Object.fromEntries(server)).toEqual(
      Object.fromEntries([...app].map(([uid, s]) => [uid, s.points])),
    );
    expect(server.get("a")).toBe(20);
    expect(server.get("b")).toBe(30);
  });
});
