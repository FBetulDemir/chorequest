import { db } from "@/src/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import type { Household } from "@/src/types";
import { ensureUserProfile } from "@/src/lib/profile";

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function householdRef(hid: string) {
  return doc(db, "households", hid);
}

function userRef(uid: string) {
  return doc(db, "users", uid);
}

export async function createHousehold(params: {
  uid: string;
  name: string;
  email?: string | null;
}): Promise<Household> {
  await ensureUserProfile({ uid: params.uid, email: params.email ?? null });

  const hidRef = doc(collection(db, "households"));
  const now = Date.now();

  const household: Household = {
    id: hidRef.id,
    name: params.name.trim() || "Household",
    code: randomCode(6),
    createdAt: now,
    updatedAt: now,
    members: { [params.uid]: true } as any,
  };

  const batch = writeBatch(db);
  batch.set(hidRef, household);

  // ✅ keep profile in sync
  batch.update(userRef(params.uid), {
    householdId: hidRef.id,
    updatedAt: now,
  });

  await batch.commit();
  return household;
}

export async function joinHouseholdByCode(params: {
  uid: string;
  code: string;
  email?: string | null;
}): Promise<Household> {
  await ensureUserProfile({ uid: params.uid, email: params.email ?? null });

  const code = params.code.trim().toUpperCase();

  const q = query(collection(db, "households"), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Household code not found.");

  const d = snap.docs[0];
  const hid = d.id;
  const now = Date.now();

  const batch = writeBatch(db);

  // ✅ old model membership
  batch.update(householdRef(hid), {
    [`members.${params.uid}`]: true,
    updatedAt: now,
  });

  // ✅ critical: set user householdId
  batch.update(userRef(params.uid), {
    householdId: hid,
    updatedAt: now,
  });

  await batch.commit();

  const updated = await getHousehold(hid);
  if (!updated) throw new Error("Household disappeared after join.");
  return updated;
}

export async function getHousehold(hid: string): Promise<Household | null> {
  const ref = householdRef(hid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const d = snap.data() as any;
  return {
    id: hid,
    name: d.name ?? "Household",
    code: d.code ?? "",
    members: d.members ?? {},
    createdAt: Number(d.createdAt ?? Date.now()),
    updatedAt: Number(d.updatedAt ?? Date.now()),
  };
}
