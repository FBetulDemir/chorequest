// src/lib/plan.ts
// Free vs ChoreQuest Plus. Plus belongs to the household, so one purchase covers
// everyone in it. The household's `plan` field is written only by the server
// (RevenueCat webhook → Cloud Function), never by the app.
import type { Household } from "@/src/lib/types";

/** The paywall is off until launch; until then everyone gets every feature. */
export const PAYWALL_ENABLED = process.env.NEXT_PUBLIC_PAYWALL_ENABLED === "1";

/** Households created before this time (ms) keep Plus for free as founding households. */
const FOUNDERS_BEFORE = Number(process.env.NEXT_PUBLIC_FOUNDERS_BEFORE || 0);

export const PLUS_ENTITLEMENT = "plus";

export const FREE_LIMITS = { members: 2, chores: 15 } as const;

export type PlanStatus = {
  tier: "free" | "plus";
  /** Why the household has Plus: paid, founding household, or paywall not live yet */
  reason: "subscription" | "founder" | "open" | null;
  expiresAt: number | null;
};

/** A purchase made on this device that the server may not have recorded yet. */
export type LocalEntitlement = { active: boolean; until: number | null } | null;

export function planFor(
  household: Pick<Household, "plan" | "createdAt"> | null,
  opts: {
    now?: number;
    paywall?: boolean;
    foundersBefore?: number;
    local?: LocalEntitlement;
  } = {},
): PlanStatus {
  const now = opts.now ?? Date.now();
  const paywall = opts.paywall ?? PAYWALL_ENABLED;
  const foundersBefore = opts.foundersBefore ?? FOUNDERS_BEFORE;

  if (!paywall) return { tier: "plus", reason: "open", expiresAt: null };

  const p = household?.plan;
  if (p?.tier === "plus" && (p.expiresAt == null || p.expiresAt > now)) {
    return { tier: "plus", reason: "subscription", expiresAt: p.expiresAt ?? null };
  }

  const local = opts.local;
  if (local?.active && (local.until == null || local.until > now)) {
    return { tier: "plus", reason: "subscription", expiresAt: local.until };
  }

  if (foundersBefore && household && household.createdAt < foundersBefore) {
    return { tier: "plus", reason: "founder", expiresAt: null };
  }

  return { tier: "free", reason: null, expiresAt: null };
}

export const isPlus = (plan: PlanStatus) => plan.tier === "plus";

export function choreLimitReached(plan: PlanStatus, choreCount: number, adding = 1): boolean {
  return !isPlus(plan) && choreCount + adding > FREE_LIMITS.chores;
}

export function memberLimitReached(plan: PlanStatus, memberCount: number): boolean {
  return !isPlus(plan) && memberCount >= FREE_LIMITS.members;
}
