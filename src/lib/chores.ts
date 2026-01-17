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
  serverTimestamp,
} from "firebase/firestore";
import type { ChoreTemplate, ChoreTemplateInput } from "@/src/types";

function userChoresCol(uid: string) {
  return collection(db, "users", uid, "choreTemplates");
}

export async function listChoreTemplates(
  uid: string,
): Promise<ChoreTemplate[]> {
  const q = query(userChoresCol(uid), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      title: data.title ?? "",
      points: Number(data.points ?? 0),
      frequency: data.frequency ?? "weekly",
      assigneeMode: data.assigneeMode ?? "anyone",
      fixedAssignee: data.fixedAssignee,
      active: Boolean(data.active ?? true),
      createdAt: Number(data.createdAt ?? Date.now()),
      updatedAt: Number(data.updatedAt ?? Date.now()),
    } satisfies ChoreTemplate;
  });
}

export async function createChoreTemplate(
  uid: string,
  input: ChoreTemplateInput,
): Promise<string> {
  const ref = doc(userChoresCol(uid)); // auto id
  const now = Date.now();

  await setDoc(ref, {
    ...input,
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

export async function updateChoreTemplate(
  uid: string,
  id: string,
  patch: Partial<ChoreTemplateInput>,
): Promise<void> {
  const ref = doc(db, "users", uid, "choreTemplates", id);
  await updateDoc(ref, {
    ...patch,
    updatedAt: Date.now(),
  });
}

export async function deleteChoreTemplate(
  uid: string,
  id: string,
): Promise<void> {
  const ref = doc(db, "users", uid, "choreTemplates", id);
  await deleteDoc(ref);
}
