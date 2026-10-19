// src/lib/assignee.ts
import type { ChoreTemplate } from "@/src/lib/types";
import type { HouseholdMember } from "@/src/lib/members";

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function dayIndexFromDayKey(dayKey: string) {
  // Use noon to avoid DST edge weirdness.
  const d = new Date(`${dayKey}T12:00:00`);
  return Math.floor(d.getTime() / 86400000);
}

/**
 * Who a chore occurrence belongs to. `null` means anyone can do it.
 *
 * Rotating chores use the same formula as the deployed app so both show the
 * same person while they run side by side. A fairer rotation is planned (roadmap §3).
 */
export function assigneeUidFor(
  chore: ChoreTemplate,
  dayKey: string,
  members: HouseholdMember[],
): string | null {
  if (chore.assigneeMode === "fixed") return chore.fixedAssigneeUid ?? null;
  if (chore.assigneeMode === "rotating") {
    if (!members.length) return null;
    const idx = (hashStr(chore.id) + dayIndexFromDayKey(dayKey)) % members.length;
    return members[idx].uid;
  }
  return null;
}

/** Short label such as "🎯 Betül", "🔁 Alex" or "👥 Anyone". */
export function assigneeLabel(
  chore: ChoreTemplate,
  dayKey: string,
  members: HouseholdMember[],
): string {
  const uid = assigneeUidFor(chore, dayKey, members);
  const name = uid ? members.find((m) => m.uid === uid)?.name : null;

  if (chore.assigneeMode === "fixed") return name ? `🎯 ${name}` : "🎯 Fixed";
  if (chore.assigneeMode === "rotating") return name ? `🔁 ${name}` : "🔁 Rotating";
  return "👥 Anyone";
}
