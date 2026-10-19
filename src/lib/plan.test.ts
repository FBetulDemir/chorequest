import { describe, expect, it } from "vitest";
import { choreLimitReached, memberLimitReached, planFor } from "@/src/lib/plan";

const now = 1_800_000_000_000;
const household = (p: { plan?: { tier: "plus"; expiresAt: number | null } | null; createdAt?: number } = {}) => ({
  plan: p.plan ?? null,
  createdAt: p.createdAt ?? now - 1000,
});

describe("planFor", () => {
  it("unlocks everything while the paywall is off", () => {
    expect(planFor(household(), { now, paywall: false })).toMatchObject({ tier: "plus", reason: "open" });
  });

  it("is free without a subscription", () => {
    expect(planFor(household(), { now, paywall: true })).toMatchObject({ tier: "free" });
  });

  it("honours an active subscription and ignores an expired one", () => {
    expect(planFor(household({ plan: { tier: "plus", expiresAt: now + 1 } }), { now, paywall: true }).tier).toBe("plus");
    expect(planFor(household({ plan: { tier: "plus", expiresAt: now - 1 } }), { now, paywall: true }).tier).toBe("free");
    expect(planFor(household({ plan: { tier: "plus", expiresAt: null } }), { now, paywall: true }).tier).toBe("plus");
  });

  it("uses a fresh purchase on this device before the server catches up", () => {
    expect(planFor(household(), { now, paywall: true, local: { active: true, until: now + 1000 } }).tier).toBe("plus");
  });

  it("keeps founding households on Plus", () => {
    const old = household({ createdAt: now - 10_000 });
    expect(planFor(old, { now, paywall: true, foundersBefore: now - 5000 })).toMatchObject({ tier: "plus", reason: "founder" });
    expect(planFor(household(), { now, paywall: true, foundersBefore: now - 5000 }).tier).toBe("free");
  });
});

describe("limits", () => {
  const free = planFor(household(), { now, paywall: true });
  const plus = planFor(household(), { now, paywall: false });

  it("caps chores and members on the free plan only", () => {
    expect(choreLimitReached(free, 14)).toBe(false);
    expect(choreLimitReached(free, 15)).toBe(true);
    expect(choreLimitReached(free, 5, 12)).toBe(true);
    expect(choreLimitReached(plus, 99)).toBe(false);
    expect(memberLimitReached(free, 1)).toBe(false);
    expect(memberLimitReached(free, 2)).toBe(true);
    expect(memberLimitReached(plus, 10)).toBe(false);
  });
});
