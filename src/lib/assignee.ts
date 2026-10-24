// src/lib/assignee.ts
import type { ChoreTemplate, PointsLedgerEntry } from "@/src/lib/types";
import type { HouseholdMember } from "@/src/lib/members";
import { survivingCompletions } from "@/src/lib/ledgerHelpers";

/** Who a chore occurrence belongs to. `null` means anyone can do it. */
export type AssigneeResolver = (chore: ChoreTemplate, dayKey: string) => string | null;

type OpenOccurrence = { templateId: string; dayKey: string; dateMs: number };

/**
 * Fair rotation for "take turns" chores: the next open occurrence goes to the
 * member after whoever completed the chore most recently, and later open
 * occurrences continue the rotation from there.
 *
 * - Helping out doesn't skip anyone: if you do your partner's turn, it's
 *   still theirs next time.
 * - Skipping keeps the turn with the same person.
 * - Members are ordered by user ID, so the order stays stable when someone
 *   renames themselves.
 */
export function createAssigneeResolver(params: {
  members: HouseholdMember[];
  ledger: PointsLedgerEntry[];
  /** Occurrences still to do (overdue and upcoming), across all chores */
  openOccurrences: OpenOccurrence[];
}): AssigneeResolver {
  const order = params.members.map((m) => m.uid).sort();

  // Most recent (not undone) completion per chore
  const last = new Map<string, { uid: string; at: number }>();
  for (const e of survivingCompletions(params.ledger)) {
    if (!e.templateId) continue;
    const at = Number(e.createdAt ?? 0);
    const cur = last.get(e.templateId);
    if (!cur || at > cur.at) last.set(e.templateId, { uid: e.actorUid, at });
  }

  // Position of each open occurrence within its chore (0 = the next one due)
  const position = new Map<string, number>();
  const byTemplate = new Map<string, OpenOccurrence[]>();
  for (const o of params.openOccurrences) {
    const list = byTemplate.get(o.templateId) ?? [];
    list.push(o);
    byTemplate.set(o.templateId, list);
  }
  for (const [tid, list] of byTemplate) {
    list.sort((a, b) => a.dateMs - b.dateMs);
    list.forEach((o, i) => position.set(`${tid}__${o.dayKey}`, i));
  }

  return (chore, dayKey) => {
    if (chore.assigneeMode === "fixed") return chore.fixedAssigneeUid ?? null;
    if (chore.assigneeMode !== "rotating" || order.length === 0) return null;

    const lastUid = last.get(chore.id)?.uid;
    const start = lastUid ? order.indexOf(lastUid) + 1 : 0; // -1 + 1 = 0 if they left
    const k = position.get(`${chore.id}__${dayKey}`) ?? 0;
    return order[(start + k) % order.length];
  };
}
