import { db } from "@/src/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Household } from "@/src/lib/types";

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

export async function createHousehold(params: {
  uid: string;
  name: string;
}): Promise<Household> {
  const hidRef = doc(collection(db, "households")); // auto id
  const now = Date.now();

  const code = randomCode(6);

  const household: Household = {
    id: hidRef.id,
    name: params.name.trim() || "Household",
    code,
    createdAt: now,
    updatedAt: now,
    // IMPORTANT: rules expect a members map
    members: { [params.uid]: true } as any,
  };

  await setDoc(hidRef, {
    ...household,
    createdAt: now,
    updatedAt: now,
    members: { [params.uid]: true },
  });

  return household;
}

export async function joinHouseholdByCode(params: {
  uid: string;
  code: string;
}): Promise<Household> {
  const code = params.code.trim().toUpperCase();

  // IMPORTANT: rules allow list only with limit(1)
  const q = query(
    collection(db, "households"),
    where("code", "==", code),
    limit(1),
  );

  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Household code not found.");

  const d = snap.docs[0];
  const hid = d.id;

  const now = Date.now();

  // IMPORTANT: add member to the members map (what your rules check)
  await updateDoc(householdRef(hid), {
    [`members.${params.uid}`]: true,
    updatedAt: now,
  });

  const data = d.data() as any;

  return {
    id: hid,
    name: data.name ?? "Household",
    code: data.code ?? code,
    members: data.members ?? {},
    createdAt: Number(data.createdAt ?? now),
    updatedAt: now,
  };
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
