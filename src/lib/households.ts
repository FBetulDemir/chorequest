import { db } from "@/src/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Household } from "@/src/types";

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function householdRef(hid: string) {
  return doc(db, "households", hid);
}

function memberRef(hid: string, uid: string) {
  return doc(db, "households", hid, "members", uid);
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
    createdAt: now,
    updatedAt: now,
    // NOTE: we no longer store a big "members" map on the household doc
    // members will live under households/{hid}/members/{uid}
    members: {}, // keep field for type compatibility if your type expects it
  };

  // Create household
  await setDoc(hidRef, {
    ...household,
    createdAt: now,
    updatedAt: now,
  });

  // Add creator as a member doc
  await setDoc(memberRef(hidRef.id, params.uid), {
    uid: params.uid,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return household;
}

export async function joinHouseholdByCode(params: {
  uid: string;
  code: string;
}): Promise<Household> {
  const code = params.code.trim().toUpperCase();

  const q = query(collection(db, "households"), where("code", "==", code));
  const snap = await getDocs(q);

  if (snap.empty) throw new Error("Household code not found.");

  const d = snap.docs[0];
  const hid = d.id;

  // Ensure member doc exists
  const now = Date.now();
  await setDoc(
    memberRef(hid, params.uid),
    {
      uid: params.uid,
      joinedAt: now,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );

  // Touch household updatedAt (optional)
  await updateDoc(householdRef(hid), { updatedAt: now });

  const data = d.data() as any;

  return {
    id: hid,
    name: data.name ?? "Household",
    code: data.code ?? code,
    members: {}, // members are in subcollection
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
    members: {}, // members are in subcollection
    createdAt: Number(d.createdAt ?? Date.now()),
    updatedAt: Number(d.updatedAt ?? Date.now()),
  };
}
