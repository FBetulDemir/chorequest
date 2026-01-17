import { db } from "@/src/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

export type ActivityEvent = {
  id: string;
  type: "complete";
  uid: string;
  points: number;
  title: string;
  icon: string;
  createdAt: number;
};

function activityCol(householdId: string) {
  return collection(db, "households", householdId, "activity");
}

export async function logCompletion(
  householdId: string,
  data: Omit<ActivityEvent, "id" | "createdAt" | "type">,
) {
  await addDoc(activityCol(householdId), {
    type: "complete",
    ...data,
    createdAt: Date.now(),
  });
}

export async function listCompletionsInRange(
  householdId: string,
  startMs: number,
  endMs: number,
): Promise<ActivityEvent[]> {
  const q = query(
    activityCol(householdId),
    where("type", "==", "complete"),
    where("createdAt", ">=", startMs),
    where("createdAt", "<", endMs),
    orderBy("createdAt", "desc"),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      type: "complete",
      uid: String(x.uid ?? ""),
      points: Number(x.points ?? 0),
      title: String(x.title ?? ""),
      icon: String(x.icon ?? ""),
      createdAt: Number(x.createdAt ?? 0),
    };
  });
}
