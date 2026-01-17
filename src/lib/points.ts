import { db } from "@/src/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import type { PointsLedgerEntry } from "@/src/types";

function ledgerCol(householdId: string) {
  return collection(db, "households", householdId, "ledger");
}

export type AddLedgerInput = Omit<PointsLedgerEntry, "id">;

export async function addLedgerEntry(
  householdId: string,
  input: AddLedgerInput,
): Promise<string> {
  const ref = await addDoc(ledgerCol(householdId), {
    ...input,
    createdAt: input.createdAt ?? Date.now(),
    // templateId and dayKey can be undefined; Firestore just won’t store them
  });
  return ref.id;
}

export async function listLedgerEntries(
  householdId: string,
  max = 200,
): Promise<PointsLedgerEntry[]> {
  const q = query(
    ledgerCol(householdId),
    orderBy("createdAt", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      actorUid: data.actorUid ?? "",
      delta: Number(data.delta ?? 0),
      reason: data.reason ?? "",
      createdAt: Number(data.createdAt ?? Date.now()),
      templateId: data.templateId,
      dayKey: data.dayKey,
    };
  });
}
