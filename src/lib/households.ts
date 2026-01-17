import { db } from "@/src/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  getDoc,
} from "firebase/firestore";
import type { Household } from "@/src/types";

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createHousehold(params: {
  uid: string;
  name: string;
}): Promise<Household> {
  const hidRef = doc(collection(db, "households")); // auto id
  const now = Date.now();

  const household: Household = {
    id: hidRef.id,
    name: params.name.trim() || "Household",
    code: randomCode(6),
    members: { [params.uid]: true },
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(hidRef, household);
  return household;
}

export async function joinHouseholdByCode(params: {
  uid: string;
  code: string;
}): Promise<Household> {
  const q = query(
    collection(db, "households"),
    where("code", "==", params.code.trim().toUpperCase()),
  );
  const snap = await getDocs(q);

  if (snap.empty) throw new Error("Household code not found.");

  const d = snap.docs[0];
  const data = d.data() as any;

  // add member
  await updateDoc(doc(db, "households", d.id), {
    [`members.${params.uid}`]: true,
    updatedAt: Date.now(),
  });

  return {
    id: d.id,
    name: data.name ?? "Household",
    code: data.code ?? params.code,
    members: data.members ?? {},
    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? Date.now()),
  };
}

export async function getHousehold(hid: string): Promise<Household | null> {
  const ref = doc(db, "households", hid);
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
