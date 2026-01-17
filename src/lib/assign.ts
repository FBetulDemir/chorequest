import type { ChoreTemplate, PointsLedgerEntry } from "@/src/types";
import type { HouseholdMember } from "@/src/lib/members";

/**
 * Returns the UID who should do the chore today based on mode.
 * - anyone: null (no fixed assignee)
 * - fixed: template.fixedAssigneeUid
 * - rotating: alternates between members, based on last completion in ledger
 */
export function resolveAssigneeUid(
  template: ChoreTemplate,
  members: HouseholdMember[],
  ledger: PointsLedgerEntry[],
  dayKey: string,
): string | null {
  if (template.assigneeMode === "anyone") return null;

  if (template.assigneeMode === "fixed") {
    return template.fixedAssigneeUid ?? null;
  }

  if (template.assigneeMode === "rotating") {
    // determine last completer for this template (any day)
    const last = ledger.find(
      (e) => e.templateId === template.id && e.delta > 0,
    );

    // if never completed -> assign first member
    if (!members.length) return null;
    if (!last?.actorUid) return members[0].uid;

    // next = member after last completer in order
    const idx = members.findIndex((m) => m.uid === last.actorUid);
    if (idx === -1) return members[0].uid;
    return members[(idx + 1) % members.length].uid;
  }

  return null;
}

export function nameForUid(members: HouseholdMember[], uid: string | null) {
  if (!uid) return "";
  return members.find((m) => m.uid === uid)?.name ?? uid.slice(0, 6);
}
