// src/lib/wallet.ts
import { survivingCompletions } from "@/src/lib/ledgerHelpers";
import type { PointsLedgerEntry, Redemption } from "@/src/lib/types";

export type Wallet = { earned: number; spent: number; balance: number };

/** Coins = all points ever earned (undos excluded) minus everything redeemed. */
export function walletFor(ledger: PointsLedgerEntry[], redemptions: Redemption[], uid: string): Wallet {
  const earned = survivingCompletions(ledger)
    .filter((e) => e.actorUid === uid)
    .reduce((sum, e) => sum + Number(e.delta ?? 0), 0);
  const spent = redemptions.filter((r) => r.uid === uid).reduce((sum, r) => sum + r.cost, 0);
  return { earned, spent, balance: earned - spent };
}
