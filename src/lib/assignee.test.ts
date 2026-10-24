import { describe, expect, it } from "vitest";
import type { ChoreTemplate, PointsLedgerEntry } from "@/src/lib/types";
import { createAssigneeResolver } from "@/src/lib/assignee";

const members = [
  { uid: "b-uid", name: "Bob" },
  { uid: "a-uid", name: "Alice" },
  { uid: "c-uid", name: "Cem" },
];
// Rotation order is by uid: a-uid, b-uid, c-uid

const dishes: ChoreTemplate = {
  id: "dishes",
  title: "🍽️ Dishes",
  points: 20,
  frequency: "daily",
  assigneeMode: "rotating",
  active: true,
  createdAt: 0,
  updatedAt: 0,
};

const open = (...days: number[]) =>
  days.map((d) => ({ templateId: "dishes", dayKey: `2026-10-${d}`, dateMs: d }));

const done = (uid: string, at: number, id = `c${at}`): PointsLedgerEntry => ({
  id,
  actorUid: uid,
  delta: 20,
  reason: "Completed: 🍽️ Dishes",
  createdAt: at,
  templateId: "dishes",
  dayKey: `2026-10-0${at}`,
});

describe("createAssigneeResolver", () => {
  it("starts with the first member when nobody has done it yet", () => {
    const who = createAssigneeResolver({ members, ledger: [], openOccurrences: open(20, 21, 22, 23) });
    expect(["20", "21", "22", "23"].map((d) => who(dishes, `2026-10-${d}`))).toEqual(["a-uid", "b-uid", "c-uid", "a-uid"]);
  });

  it("gives the next turn to whoever comes after the last person who did it", () => {
    const who = createAssigneeResolver({ members, ledger: [done("b-uid", 1)], openOccurrences: open(20, 21) });
    expect(who(dishes, "2026-10-20")).toBe("c-uid");
    expect(who(dishes, "2026-10-21")).toBe("a-uid");
  });

  it("keeps the turn when someone else helps out", () => {
    // It was Cem's turn after Bob, but Alice did it: next is Bob, then Cem
    const ledger = [done("b-uid", 1), done("a-uid", 2)];
    const who = createAssigneeResolver({ members, ledger, openOccurrences: open(20) });
    expect(who(dishes, "2026-10-20")).toBe("b-uid");
  });

  it("ignores completions that were undone", () => {
    const undo: PointsLedgerEntry = {
      id: "u1",
      actorUid: "a-uid",
      delta: -20,
      reason: "Undo: 🍽️ Dishes",
      createdAt: 3,
      templateId: "dishes",
      dayKey: "2026-10-02",
    };
    const who = createAssigneeResolver({ members, ledger: [done("b-uid", 1), done("c-uid", 2), undo], openOccurrences: open(20) });
    expect(who(dishes, "2026-10-20")).toBe("c-uid");
  });

  it("handles fixed and anyone chores", () => {
    const who = createAssigneeResolver({ members, ledger: [], openOccurrences: [] });
    expect(who({ ...dishes, assigneeMode: "fixed", fixedAssigneeUid: "c-uid" }, "2026-10-20")).toBe("c-uid");
    expect(who({ ...dishes, assigneeMode: "anyone" }, "2026-10-20")).toBeNull();
  });
});
