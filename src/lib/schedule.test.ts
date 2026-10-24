import { describe, expect, it } from "vitest";
import type { ChoreTemplate } from "@/src/lib/types";
import {
  buildOccurrences,
  buildPastOccurrences,
  dayKeyFromTs,
  describeSchedule,
  occurrencesInRange,
  ordinal,
} from "@/src/lib/schedule";

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

describe("chosen days", () => {
  const keys = (ms: number[]) => ms.map(dayKeyFromTs);
  const now = new Date(2026, 9, 19, 15).getTime(); // Mon 19 Oct 2026

  it("puts weekly chores on the chosen weekday", () => {
    const saturdays = chore({ frequency: "weekly", createdAt: day(10, 1), schedule: { weekDay: 6 } });
    expect(keys(occurrencesInRange(saturdays, day(10, 19), day(11, 1), now))).toEqual(["2026-10-24", "2026-10-31"]);
  });

  it("puts monthly chores on the chosen day of the month", () => {
    const fifteenth = chore({ frequency: "monthly", createdAt: day(9, 20), schedule: { monthDay: 15 } });
    expect(keys(occurrencesInRange(fifteenth, day(9, 1), day(12, 31), now))).toEqual([
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
    ]);
  });

  it("doesn't count dates before the day was changed", () => {
    // Changed to Mondays on the 19th: the Monday before (12 Oct) isn't "missed"
    const mondays = chore({ frequency: "weekly", createdAt: day(9, 1), schedule: { weekDay: 1, since: day(10, 19) } });
    expect(buildPastOccurrences([mondays], now, 14)).toEqual([]);
    expect(keys(occurrencesInRange(mondays, day(10, 1), day(10, 31), now))).toEqual(["2026-10-19", "2026-10-26"]);
  });

  it("keeps chores created years ago on schedule", () => {
    // Regression: weekly chores used to vanish a year after they were created
    const old = chore({ frequency: "weekly", createdAt: new Date(2023, 0, 2).getTime() }); // a Monday
    expect(keys(occurrencesInRange(old, day(10, 19), day(10, 26), now))).toEqual(["2026-10-19", "2026-10-26"]);
    const oldMonthly = chore({ frequency: "monthly", createdAt: new Date(2019, 4, 7).getTime() });
    expect(keys(occurrencesInRange(oldMonthly, day(10, 1), day(11, 30), now))).toEqual(["2026-10-07", "2026-11-07"]);
  });

  it("stays on the right weekday across a daylight-saving change", () => {
    const sundays = chore({ frequency: "weekly", createdAt: day(10, 1), schedule: { weekDay: 0 } });
    // Clocks change on Sun 25 Oct in Europe
    expect(keys(occurrencesInRange(sundays, day(10, 19), day(11, 9), now))).toEqual([
      "2026-10-25",
      "2026-11-01",
      "2026-11-08",
    ]);
  });
});

describe("describeSchedule", () => {
  it("describes each frequency in plain words", () => {
    expect(describeSchedule(chore({}))).toBe("Every day");
    expect(describeSchedule(chore({ frequency: "weekly", schedule: { weekDay: 6 } }))).toBe("Every Saturday");
    // Without a chosen day: the weekday it was created on (1 Oct 2026 was a Thursday)
    expect(describeSchedule(chore({ frequency: "weekly", createdAt: day(10, 1) }))).toBe("Every Thursday");
    expect(describeSchedule(chore({ frequency: "monthly", schedule: { monthDay: 22 } }))).toBe("22nd of each month");
    expect(describeSchedule(chore({ frequency: "seasonal" }))).toBe("Every 3 months");
  });

  it("writes English ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 28].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "28th",
    ]);
  });
});
