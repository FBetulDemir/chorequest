// src/lib/points.ts
import { db } from "@/src/lib/firebase";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import type { ChoreTemplate, PointsLedgerEntry } from "@/src/lib/types";
import type { OccurrenceStatus } from "@/src/lib/ledgerHelpers";
import { entryTitle } from "@/src/lib/ledgerHelpers";
import { choreLabel } from "@/src/lib/choreCatalog";

/** Max ledger entries kept in the live subscription. */
export const LEDGER_LIMIT = 10000;

function ledgerCol(householdId: string) {
  return collection(db, "households", householdId, "ledger");
}

export function toLedgerEntry(id: string, data: DocumentData): PointsLedgerEntry {
  return {
    id,
    actorUid: String(data.actorUid ?? ""),
    delta: Number(data.delta ?? 0),
    reason: String(data.reason ?? ""),
    createdAt: Number(data.createdAt ?? 0),
    templateId: data.templateId,
    dayKey: data.dayKey,
    type: data.type,
    targetEntryId: data.targetEntryId,
    targetUid: data.targetUid,
  };
}

/** Live ledger, newest first. Returns the unsubscribe function. */
export function subscribeLedger(
  householdId: string,
  onData: (entries: PointsLedgerEntry[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(
    ledgerCol(householdId),
    orderBy("createdAt", "desc"),
    limit(LEDGER_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toLedgerEntry(d.id, d.data()))),
    onError,
  );
}

export class AlreadyRecordedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlreadyRecordedError";
  }
}

/**
 * Creates a ledger entry with a predictable ID, only if it doesn't exist yet.
 * Two people tapping at the same moment produce the same ID, so only one wins.
 */
async function createOnce(
  householdId: string,
  id: string,
  data: Omit<PointsLedgerEntry, "id">,
  alreadyMessage: string,
) {
  const ref = doc(ledgerCol(householdId), id);
  // Firestore rejects `undefined` values.
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) throw new AlreadyRecordedError(alreadyMessage);
      tx.set(ref, clean);
    });
  } catch (e) {
    if (e instanceof AlreadyRecordedError) throw e;
    // Some rule sets don't allow reading a document that doesn't exist yet.
    // Fall back to a plain write; the predictable ID still prevents most duplicates.
    if ((e as { code?: string })?.code === "permission-denied") {
      await setDoc(ref, clean);
      return;
    }
    throw e;
  }
}

export async function recordCompletion(params: {
  householdId: string;
  uid: string;
  chore: ChoreTemplate;
  dayKey: string;
  status: OccurrenceStatus | undefined;
}): Promise<PointsLedgerEntry> {
  const { householdId, uid, chore, dayKey, status } = params;
  if (status && status.completed > 0) {
    throw new AlreadyRecordedError("This chore is already completed.");
  }
  const n = status?.completeCount ?? 0;
  const id = `c__${chore.id}__${dayKey}__${n}`;
  const data: Omit<PointsLedgerEntry, "id"> = {
    type: "complete",
    actorUid: uid,
    delta: chore.points,
    reason: `Completed: ${choreLabel(chore)}`,
    createdAt: Date.now(),
    templateId: chore.id,
    dayKey,
  };
  await createOnce(householdId, id, data, "Someone just completed this chore.");
  return { id, ...data };
}

export async function recordSkip(params: {
  householdId: string;
  uid: string;
  chore: ChoreTemplate;
  dayKey: string;
  status: OccurrenceStatus | undefined;
}) {
  const { householdId, uid, chore, dayKey, status } = params;
  if (status?.skipped) {
    throw new AlreadyRecordedError("This chore is already skipped.");
  }
  await createOnce(
    householdId,
    `s__${chore.id}__${dayKey}`,
    {
      type: "skip",
      actorUid: uid,
      delta: 0,
      reason: `Skipped: ${choreLabel(chore)}`,
      createdAt: Date.now(),
      templateId: chore.id,
      dayKey,
    },
    "Someone just skipped this chore.",
  );
}

export async function recordUndo(params: {
  householdId: string;
  uid: string;
  completion: PointsLedgerEntry;
  status: OccurrenceStatus | undefined;
}) {
  const { householdId, uid, completion, status } = params;
  if (!completion.templateId || !completion.dayKey) {
    throw new Error("This entry can't be undone.");
  }
  const n = status?.undoCount ?? 0;
  await createOnce(
    householdId,
    `u__${completion.templateId}__${completion.dayKey}__${n}`,
    {
      type: "undo",
      actorUid: uid,
      delta: -Math.abs(Number(completion.delta ?? 0)),
      reason: `Undo: ${entryTitle(completion)}`,
      createdAt: Date.now(),
      templateId: completion.templateId,
      dayKey: completion.dayKey,
      targetEntryId: completion.id,
      targetUid: completion.actorUid,
    },
    "This completion was already undone.",
  );
}
