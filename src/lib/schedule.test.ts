import { describe, expect, it } from "vitest";
import type { ChoreTemplate } from "@/src/lib/types";
import { buildOccurrences, buildPastOccurrences, dayKeyFromTs } from "@/src/lib/schedule";

const day = (m: number, d: number) => new Date(2026, m - 1, d, 0, 0, 0, 0).getTime();

function chore(p: Partial<ChoreTemplate>): ChoreTemplate {
  return {
    id: "x",
    title: "🧹 Sweep",
    points: 10,
    frequency: "daily",
    assigneeMode: "anyone",
    active: true,
    createdAt: day(10, 1),
    updatedAt: day(10, 1),
    ...p,
  };
}

describe("dayKeyFromTs", () => {
  it("uses the local date", () => {
    expect(dayKeyFromTs(new Date(2026, 0, 5, 23, 59).getTime())).toBe("2026-01-05");
  });
});

describe("buildOccurrences", () => {
  const now = new Date(2026, 9, 19, 15).getTime();

  it("creates one daily occurrence per day with today / next3 / upcoming buckets", () => {
    const occ = buildOccurrences([chore({})], now, 5);
    expect(occ.map((o) => o.dayKey)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
    expect(occ.map((o) => o.bucket)).toEqual(["today", "next3", "next3", "next3", "upcoming", "upcoming"]);
  });

  it("repeats weekly chores every 7 days from their creation date", () => {
    const occ = buildOccurrences([chore({ frequency: "weekly", createdAt: day(10, 1) })], now, 14);
    expect(occ.map((o) => o.dayKey)).toEqual(["2026-10-22", "2026-10-29"]);
  });

  it("repeats monthly chores on the same day of the month", () => {
    const occ = buildOccurrences([chore({ frequency: "monthly", createdAt: day(9, 20) })], now, 40);
    expect(occ.map((o) => o.dayKey)).toEqual(["2026-10-20", "2026-11-20"]);
  });

  it("sorts occurrences by date across chores", () => {
    const occ = buildOccurrences(
      [chore({ id: "w", frequency: "weekly", createdAt: day(10, 20) }), chore({ id: "d" })],
      now,
      1,
    );
    expect(occ.map((o) => `${o.templateId}@${o.dayKey}`)).toEqual([
      "d@2026-10-19",
      "w@2026-10-20",
      "d@2026-10-20",
    ]);
  });
});

describe("buildPastOccurrences", () => {
  const now = new Date(2026, 9, 19, 15).getTime();

  it("returns the last missed weekly occurrence", () => {
    // created Thu 1 Oct -> 8, 15, 22 ... ; last before the 19th is the 15th
    const occ = buildPastOccurrences([chore({ frequency: "weekly", createdAt: day(10, 1) })], now, 14);
    expect(occ.map((o) => [o.dayKey, o.bucket])).toEqual([["2026-10-15", "overdue"]]);
  });

  it("ignores daily chores and chores created today", () => {
    const occ = buildPastOccurrences(
      [chore({}), chore({ id: "w", frequency: "weekly", createdAt: day(10, 19) })],
      now,
      14,
    );
    expect(occ).toEqual([]);
  });

  it("respects the lookback window", () => {
    const monthly = chore({ frequency: "monthly", createdAt: day(9, 1) }); // last: 1 Oct, 18 days ago
    expect(buildPastOccurrences([monthly], now, 14)).toEqual([]);
    expect(buildPastOccurrences([monthly], now, 30).map((o) => o.dayKey)).toEqual(["2026-10-01"]);
  });
});
