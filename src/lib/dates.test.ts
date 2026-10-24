import { describe, expect, it } from "vitest";
import { daysFrom, friendlyDay, greeting, timeAgo } from "@/src/lib/dates";
import { choreLabel, choreParts, splitChoreTitle } from "@/src/lib/choreCatalog";

const today = new Date(2026, 9, 19).getTime(); // Mon 19 Oct 2026

describe("friendlyDay", () => {
  it("uses words for nearby days", () => {
    expect(friendlyDay("2026-10-19", today)).toBe("Today");
    expect(friendlyDay("2026-10-20", today)).toBe("Tomorrow");
    expect(friendlyDay("2026-10-18", today)).toBe("Yesterday");
  });

  it("shows weekday and date further out", () => {
    expect(friendlyDay("2026-10-22", today)).toBe("Thu 22 Oct");
  });

  it("adds the year for other years", () => {
    expect(friendlyDay("2027-01-04", today)).toBe("Mon, 4 Jan 2027");
  });
});

describe("daysFrom", () => {
  it("counts whole days across a DST change", () => {
    // Most European clocks go back on 25 Oct 2026
    expect(daysFrom(today, "2026-10-26")).toBe(7);
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 9, 19, 15, 0).getTime();

  it("describes recent times", () => {
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
  });

  it("names yesterday and older dates", () => {
    expect(timeAgo(new Date(2026, 9, 18, 14, 5).getTime(), now)).toBe("Yesterday, 14:05");
    expect(timeAgo(new Date(2026, 9, 12, 9, 30).getTime(), now)).toBe("12 Oct, 09:30");
  });
});

describe("greeting", () => {
  it("depends on the hour", () => {
    expect(greeting(new Date(2026, 9, 19, 8).getTime())).toBe("Good morning");
    expect(greeting(new Date(2026, 9, 19, 14).getTime())).toBe("Good afternoon");
    expect(greeting(new Date(2026, 9, 19, 20).getTime())).toBe("Good evening");
  });
});

describe("splitChoreTitle", () => {
  it("separates a leading emoji", () => {
    expect(splitChoreTitle("🧹 Sweep Kitchen Floor")).toEqual({ icon: "🧹", name: "Sweep Kitchen Floor" });
    expect(splitChoreTitle("🍽️ Do Dishes")).toEqual({ icon: "🍽️", name: "Do Dishes" });
  });

  it("keeps titles without an emoji intact", () => {
    expect(splitChoreTitle("Vacuum car")).toEqual({ icon: "✨", name: "Vacuum car" });
  });
});

describe("choreParts / choreLabel", () => {
  it("reads the separate icon field on newer chores", () => {
    expect(choreParts({ title: "Vacuum", icon: "🧹" })).toEqual({ icon: "🧹", name: "Vacuum" });
    expect(choreLabel({ title: "Vacuum", icon: "🧹" })).toBe("🧹 Vacuum");
  });

  it("falls back to the emoji in older titles", () => {
    expect(choreParts({ title: "🍽️ Do Dishes" })).toEqual({ icon: "🍽️", name: "Do Dishes" });
    expect(choreLabel({ title: "🍽️ Do Dishes" })).toBe("🍽️ Do Dishes");
  });
});
