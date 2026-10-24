export type Frequency = "daily" | "weekly" | "monthly" | "seasonal";
export type AssigneeMode = "fixed" | "rotating" | "anyone";

export type UserProfile = {
  uid: string;
  email: string | null;
  name: string; // display name you choose
  householdId: string | null;
  avatar?: string | null; // emoji picked in setup/profile (added in phase 2)
  createdAt: number;
  updatedAt: number;
};

export type HouseholdPlan = {
  tier: "plus";
  expiresAt: number | null; // null = doesn't expire
  store?: string;
  productId?: string;
  purchaserUid?: string;
  updatedAt?: number;
};

export type Household = {
  id: string;
  name: string;
  code: string; // share this with partner to join
  members: Record<string, boolean>; // { [uid]: true }
  plan?: HouseholdPlan | null; // set by the server only (see functions/)
  createdAt: number;
  updatedAt: number;
};

export type ChoreTemplate = {
  id: string;
  title: string; // older chores have the emoji in the title, e.g. "🧹 Sweep"
  icon?: string; // newer chores store the emoji separately
  points: number;
  frequency: Frequency;
  assigneeMode: AssigneeMode;
  active: boolean;
  fixedAssigneeUid?: string; // for fixed mode: the uid of the assigned member

  createdAt: number; // NEW (anchor)
  updatedAt: number;
  schedule?: ChoreSchedule; // NEW
};

export type ChoreTemplateInput = Omit<
  ChoreTemplate,
  "id" | "createdAt" | "updatedAt"
>;

export type LedgerEntryType = "complete" | "skip" | "undo";

export type PointsLedgerEntry = {
  id: string;
  actorUid: string;
  delta: number;
  reason: string; // human-readable, e.g. "Completed: 🧹 Sweep". Older entries rely on its prefix.
  createdAt: number;

  templateId?: string;
  dayKey?: string; // e.g. "2026-01-17"

  // Added in phase 1. Entries written before that only have `reason`.
  type?: LedgerEntryType;
  targetEntryId?: string; // undo: the completion entry it cancels
  targetUid?: string; // undo: who originally earned the points
};

export type ChoreSchedule = {
  // for weekly chores: 0=Sun ... 6=Sat
  weekDay?: number;

  // for monthly chores: 1..28 (we keep it safe)
  monthDay?: number;

  // for seasonal chores: month number 1..12
  seasonalMonth?: number;
  seasonalDay?: number; // 1..28

  // When the day was last changed (ms). Earlier dates don't count, so changing
  // the day doesn't make old dates look missed.
  since?: number;
};

// Rewards shop (see src/lib/rewards.ts)
export type Reward = {
  id: string;
  title: string;
  icon: string;
  cost: number;
  active: boolean;
  createdBy: string;
  createdAt: number;
};

export type RedemptionStatus = "pending" | "fulfilled";

export type Redemption = {
  id: string;
  rewardId: string;
  title: string;
  icon: string;
  cost: number;
  uid: string;
  status: RedemptionStatus;
  createdAt: number;
  fulfilledBy?: string;
  fulfilledAt?: number;
};
