import { describe, expect, it } from "vitest";
import type { PointsLedgerEntry, Redemption } from "@/src/lib/types";
import { walletFor } from "@/src/lib/wallet";

const entry = (p: Partial<PointsLedgerEntry> & { id: string }): PointsLedgerEntry => ({
  actorUid: "a",
  delta: 0,
  reason: "",
  createdAt: 1,
  templateId: "t",
  dayKey: p.id,
  ...p,
});

const redemption = (uid: string, cost: number): Redemption => ({
  id: `r-${uid}-${cost}`,
  rewardId: "x",
  title: "Movie",
  icon: "🎬",
  cost,
  uid,
  status: "pending",
  createdAt: 1,
});

describe("walletFor", () => {
  it("subtracts redemptions from points earned", () => {
    const ledger = [
      entry({ id: "1", delta: 200, reason: "Completed: A" }),
      entry({ id: "2", delta: 150, reason: "Completed: B" }),
      entry({ id: "3", delta: 300, reason: "Completed: C", actorUid: "b" }),
    ];
    expect(walletFor(ledger, [redemption("a", 100), redemption("b", 50)], "a")).toEqual({
      earned: 350,
      spent: 100,
      balance: 250,
    });
  });

  it("doesn't count undone completions", () => {
    const ledger = [
      entry({ id: "d1", delta: 100, reason: "Completed: A", dayKey: "k", createdAt: 1 }),
      entry({ id: "u1", delta: -100, reason: "Undo: A", dayKey: "k", createdAt: 2 }),
    ];
    expect(walletFor(ledger, [], "a").balance).toBe(0);
  });
});
