import { describe, expect, it } from "vitest";
import type { PointsLedgerEntry } from "@/src/lib/types";
import {
  buildStatusByOccurrence,
  entryKind,
  entryTitle,
  findUndoneCompletionIds,
  isOccurrenceDone,
  isOccurrenceOpen,
  occurrenceKey,
  survivingCompletions,
} from "@/src/lib/ledgerHelpers";

const t = (h: number) => new Date(2026, 9, 19, h).getTime();

function entry(p: Partial<PointsLedgerEntry> & { id: string }): PointsLedgerEntry {
  return {
    actorUid: "a",
    delta: 0,
    reason: "",
    createdAt: t(9),
    templateId: "dishes",
    dayKey: "2026-10-19",
    ...p,
  };
}

const complete = (id: string, h: number, extra: Partial<PointsLedgerEntry> = {}) =>
  entry({ id, reason: "Completed: 🍽️ Dishes", delta: 20, createdAt: t(h), ...extra });
const undo = (id: string, h: number, extra: Partial<PointsLedgerEntry> = {}) =>
  entry({ id, reason: "Undo: 🍽️ Dishes", delta: -20, createdAt: t(h), ...extra });

describe("entryKind", () => {
  it("reads legacy entries by their reason prefix", () => {
    expect(entryKind(complete("1", 9))).toBe("complete");
    expect(entryKind(undo("2", 9))).toBe("undo");
    expect(entryKind(entry({ id: "3", reason: "Skipped: Dishes" }))).toBe("skip");
    expect(entryKind(entry({ id: "4", reason: "Bonus" }))).toBe("other");
  });

  it("prefers the explicit type on new entries", () => {
    expect(entryKind(entry({ id: "1", type: "skip", reason: "whatever" }))).toBe("skip");
  });
});

describe("entryTitle", () => {
  it("strips the action prefix", () => {
    expect(entryTitle(complete("1", 9))).toBe("🍽️ Dishes");
    expect(entryTitle(undo("2", 9))).toBe("🍽️ Dishes");
  });
});

describe("buildStatusByOccurrence", () => {
  const key = occurrenceKey("dishes", "2026-10-19");

  it("is not affected by ledger order (newest-first input)", () => {
    // complete -> undo, delivered newest first like the live ledger
    const st = buildStatusByOccurrence([undo("u", 10), complete("c", 9)]).get(key);
    expect(st?.completed).toBe(0);
    expect(isOccurrenceOpen(st)).toBe(true);
  });

  it("counts a re-completion after an undo", () => {
    const st = buildStatusByOccurrence([complete("c2", 11), undo("u", 10), complete("c1", 9)]).get(key);
    expect(st?.completed).toBe(1);
    expect(st?.completeCount).toBe(2);
    expect(st?.undoCount).toBe(1);
    expect(isOccurrenceDone(st)).toBe(true);
  });

  it("keys entries by their due day, not the day they were tapped", () => {
    // Tomorrow's chore completed early today
    const early = complete("c", 9, { dayKey: "2026-10-20" });
    const map = buildStatusByOccurrence([early]);
    expect(map.get(occurrenceKey("dishes", "2026-10-20"))?.completed).toBe(1);
    expect(map.get(key)).toBeUndefined();
  });

  it("treats skipped occurrences as not open", () => {
    const st = buildStatusByOccurrence([entry({ id: "s", reason: "Skipped: Dishes" })]).get(key);
    expect(isOccurrenceOpen(st)).toBe(false);
    expect(isOccurrenceDone(st)).toBe(false);
  });
});

describe("survivingCompletions", () => {
  it("cancels the latest earlier completion for legacy undos", () => {
    const ledger = [complete("c1", 8), complete("c2", 9), undo("u", 10)];
    expect([...findUndoneCompletionIds(ledger)]).toEqual(["c2"]);
    expect(survivingCompletions(ledger).map((e) => e.id)).toEqual(["c1"]);
  });

  it("cancels exactly the targeted completion for new undos", () => {
    const ledger = [complete("c1", 8), complete("c2", 9), undo("u", 10, { targetEntryId: "c1" })];
    expect(survivingCompletions(ledger).map((e) => e.id)).toEqual(["c2"]);
  });

  it("ignores an undo with nothing to cancel", () => {
    const ledger = [undo("u", 10), complete("c1", 11)];
    expect(survivingCompletions(ledger).map((e) => e.id)).toEqual(["c1"]);
  });
});
