export type Frequency = "daily" | "weekly" | "monthly" | "seasonal";
export type AssigneeMode = "fixed" | "rotating" | "anyone";

export type UserProfile = {
  uid: string;
  email: string | null;
  name: string; // display name you choose
  householdId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Household = {
  id: string;
  name: string;
  code: string; // share this with partner to join
  members: Record<string, boolean>; // { [uid]: true }
  createdAt: number;
  updatedAt: number;
};

export type ChoreTemplate = {
  id: string;
  title: string;
  points: number;
  frequency: Frequency;
  assigneeMode: AssigneeMode;
  active: boolean;
  fixedAssigneeUid?: string; // for fixed mode: the uid of the assigned member

  createdAt: number; // NEW (anchor)
  schedule?: ChoreSchedule; // NEW
};

export type ChoreTemplateInput = Omit<
  ChoreTemplate,
  "id" | "createdAt" | "updatedAt"
>;

export type PointsLedgerEntry = {
  id: string;
  actorUid: string;
  delta: number;
  reason: string;
  createdAt: number;

  templateId?: string; // NEW
  dayKey?: string; // NEW e.g. "2026-01-17"
};

export type ChoreSchedule = {
  // for weekly chores: 0=Sun ... 6=Sat
  weekDay?: number;

  // for monthly chores: 1..28 (we keep it safe)
  monthDay?: number;

  // for seasonal chores: month number 1..12
  seasonalMonth?: number;
  seasonalDay?: number; // 1..28
};
