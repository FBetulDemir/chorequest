import { db } from "@/src/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { ChoreTemplate, ChoreTemplateInput } from "./types";

function choresCol(householdId: string) {
  return collection(db, "households", householdId, "choreTemplates");
}

export async function listChoreTemplates(
  householdId: string,
): Promise<ChoreTemplate[]> {
  const q = query(choresCol(householdId), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;

    return {
      id: d.id,
      title: data.title ?? "",
      points: Number(data.points ?? 0),
      frequency: data.frequency ?? "weekly",
      assigneeMode: data.assigneeMode ?? "anyone",
      fixedAssigneeUid: data.fixedAssigneeUid,
      active: Boolean(data.active ?? true),

      // keep schedule always present
      schedule: data.schedule ?? {},

      createdAt: Number(data.createdAt ?? Date.now()),
      updatedAt: Number(data.updatedAt ?? Date.now()),
    } as ChoreTemplate;
  });
}

export async function createChoreTemplate(
  householdId: string,
  input: ChoreTemplateInput,
): Promise<string> {
  const ref = doc(choresCol(householdId)); // auto id
  const now = Date.now();

  await setDoc(ref, {
    ...input,
    schedule: (input as any).schedule ?? {}, // safe default
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

export async function updateChoreTemplate(
  householdId: string,
  id: string,
  patch: Partial<ChoreTemplateInput>,
): Promise<void> {
  const ref = doc(db, "households", householdId, "choreTemplates", id);

  await updateDoc(ref, {
    ...patch,
    ...((patch as any).schedule ? { schedule: (patch as any).schedule } : {}),
    updatedAt: Date.now(),
  });
}

export async function deleteChoreTemplate(
  householdId: string,
  id: string,
): Promise<void> {
  const ref = doc(db, "households", householdId, "choreTemplates", id);
  await deleteDoc(ref);
}
