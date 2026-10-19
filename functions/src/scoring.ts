// Server-side copy of the app's scoring rules (src/lib/ledgerHelpers.ts and
// src/lib/scoring.ts). Keep the two in sync if the rules change.

export type LedgerDoc = {
  id: string;
  actorUid?: string;
  delta?: number;
  reason?: string;
  createdAt?: number;
  templateId?: string;
  dayKey?: string;
  type?: string;
  targetEntryId?: string;
};

export function isCompletion(e: Partial<LedgerDoc>): boolean {
  if (e.type) return e.type === "complete";
  return String(e.reason ?? "").startsWith("Completed:") && Number(e.delta ?? 0) > 0;
}

function isUndo(e: LedgerDoc): boolean {
  if (e.type) return e.type === "undo";
  return String(e.reason ?? "").startsWith("Undo:") && Number(e.delta ?? 0) < 0;
}

/**
 * Points per member for completions created since `sinceMs` that weren't undone.
 * An undo cancels its target completion, or the latest earlier completion of the same chore and day.
 */
export function weeklyPoints(entries: LedgerDoc[], sinceMs: number): Map<string, number> {
  const sorted = [...entries].sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0));
  const open = new Map<string, LedgerDoc[]>();
  const undone = new Set<string>();

  for (const e of sorted) {
    if (!e.templateId || !e.dayKey) continue;
    const key = `${e.templateId}__${e.dayKey}`;
    if (isCompletion(e)) {
      open.set(key, [...(open.get(key) ?? []), e]);
    } else if (isUndo(e)) {
      const list = open.get(key) ?? [];
      let idx = e.targetEntryId ? list.findIndex((c) => c.id === e.targetEntryId) : -1;
      if (idx === -1) idx = list.length - 1;
      if (idx >= 0) {
        undone.add(list[idx].id);
        list.splice(idx, 1);
      }
    }
  }

  const points = new Map<string, number>();
  for (const e of sorted) {
    if (!isCompletion(e) || undone.has(e.id) || Number(e.createdAt ?? 0) < sinceMs) continue;
    const uid = String(e.actorUid ?? "");
    points.set(uid, (points.get(uid) ?? 0) + Number(e.delta ?? 0));
  }
  return points;
}
