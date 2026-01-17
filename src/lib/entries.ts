import { db } from "@/src/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";

export type ChoreEntryStatus = "completed" | "skipped";

export type ChoreEntry = {
  id: string;
  templateId: string;
  dateKey: string; // YYYY-MM-DD
  status: ChoreEntryStatus;
  points: number;
  byUid: string;
  createdAt: number;
};

function entriesCol(householdId: string) {
  return collection(db, "households", householdId, "choreEntries");
}

export async function listEntriesByDateRange(
  householdId: string,
  fromDateKey: string,
  toDateKey: string,
): Promise<ChoreEntry[]> {
  const q = query(
    entriesCol(householdId),
    where("dateKey", ">=", fromDateKey),
    where("dateKey", "<=", toDateKey),
    orderBy("dateKey", "desc"),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      templateId: String(data.templateId ?? ""),
      dateKey: String(data.dateKey ?? ""),
      status: (data.status ?? "completed") as ChoreEntryStatus,
      points: Number(data.points ?? 0),
      byUid: String(data.byUid ?? ""),
      createdAt: Number(data.createdAt ?? Date.now()),
    };
  });
}

export async function addEntry(
  householdId: string,
  entry: Omit<ChoreEntry, "id">,
): Promise<string> {
  const ref = doc(entriesCol(householdId)); // auto id
  await setDoc(ref, entry);
  return ref.id;
}
