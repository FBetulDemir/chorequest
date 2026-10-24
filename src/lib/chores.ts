import { db } from "@/src/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import type { ChoreTemplate, ChoreTemplateInput } from "./types";

function choresCol(householdId: string) {
  return collection(db, "households", householdId, "choreTemplates");
}

function toChoreTemplate(id: string, data: DocumentData): ChoreTemplate {
  return {
    id,
    title: data.title ?? "",
    icon: typeof data.icon === "string" && data.icon ? data.icon : undefined,
    points: Number(data.points ?? 0),
    frequency: data.frequency ?? "weekly",
    assigneeMode: data.assigneeMode ?? "anyone",
    fixedAssigneeUid: data.fixedAssigneeUid,
    active: Boolean(data.active ?? true),

    // keep schedule always present
    schedule: data.schedule ?? {},

    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? Date.now()),
  };
}

export async function listChoreTemplates(
  householdId: string,
): Promise<ChoreTemplate[]> {
  const q = query(choresCol(householdId), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toChoreTemplate(d.id, d.data()));
}

/** Live chore templates, most recently updated first. Returns the unsubscribe function. */
export function subscribeChoreTemplates(
  householdId: string,
  onData: (templates: ChoreTemplate[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(choresCol(householdId), orderBy("updatedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toChoreTemplate(d.id, d.data()))),
    onError,
  );
}

export async function createChoreTemplate(
  householdId: string,
  input: ChoreTemplateInput,
): Promise<string> {
  const ref = doc(choresCol(householdId)); // auto id
  const now = Date.now();

  await setDoc(ref, {
    ...input,
    schedule: input.schedule ?? {}, // safe default
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
