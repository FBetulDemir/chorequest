export type Frequency = "daily" | "weekly" | "monthly" | "seasonal";
export type AssigneeMode = "fixed" | "rotating" | "anyone";

export type ChoreTemplate = {
  id: string;
  title: string;
  points: number; // difficulty points
  frequency: Frequency;

  assigneeMode: AssigneeMode;
  fixedAssignee?: "me" | "wife"; // only used when assigneeMode === "fixed"
  active: boolean;

  createdAt: number; // Date.now()
  updatedAt: number; // Date.now()
};

export type ChoreTemplateInput = Omit<
  ChoreTemplate,
  "id" | "createdAt" | "updatedAt"
>;
