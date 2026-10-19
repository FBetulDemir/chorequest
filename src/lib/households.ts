import { auth, db } from "@/src/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Household } from "@/src/lib/types";
import { ensureUserProfile } from "@/src/lib/profile";

function randomCode(len = 6) {
  // No 0/O or 1/I, so codes are easy to read aloud.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function householdRef(hid: string) {
  return doc(db, "households", hid);
}

function userRef(uid: string) {
  return doc(db, "users", uid);
}

function requireAuthUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  return uid;
}

export async function createHousehold(params: {
  uid: string;
  name: string;
  email?: string | null;
}): Promise<Household> {
  const authUid = requireAuthUid();

  await ensureUserProfile({ uid: authUid, email: params.email ?? null });

  const hidRef = doc(collection(db, "households"));
  const now = Date.now();

  const household: Household = {
    id: hidRef.id,
    name: params.name.trim() || "Household",
    code: randomCode(6),
    createdAt: now,
    updatedAt: now,
    members: { [authUid]: true },
  };

  // Create household
  await setDoc(hidRef, household);

  // Sync user profile
  await updateDoc(userRef(authUid), {
    householdId: hidRef.id,
    updatedAt: now,
  });

  return household;
}

export async function joinHouseholdByCode(params: {
  uid: string;
  code: string;
}): Promise<Household> {
  const authUid = requireAuthUid();

  const code = params.code.trim().toUpperCase();

  const q = query(collection(db, "households"), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Household code not found.");

  const d = snap.docs[0];
  const hid = d.id;
  const now = Date.now();

  // 1) Household membership update
  await updateDoc(householdRef(hid), {
    [`members.${authUid}`]: true,
    updatedAt: now,
  });

  // 2) User profile householdId update
  await updateDoc(userRef(authUid), {
    householdId: hid,
    updatedAt: now,
  });

  const updated = await getHousehold(hid);
  if (!updated) throw new Error("Household disappeared after join.");
  return updated;
}

export async function getHousehold(hid: string): Promise<Household | null> {
  const ref = householdRef(hid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const d = snap.data();
  return {
    id: hid,
    name: d.name ?? "Household",
    code: d.code ?? "",
    members: d.members ?? {},
    createdAt: Number(d.createdAt ?? Date.now()),
    updatedAt: Number(d.updatedAt ?? Date.now()),
  };
}

export async function renameHousehold(hid: string, name: string): Promise<void> {
  await updateDoc(householdRef(hid), {
    name: name.trim() || "Household",
    updatedAt: Date.now(),
  });
}
