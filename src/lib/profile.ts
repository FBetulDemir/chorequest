import { db } from "@/src/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { UserProfile } from "@/src/lib/types";

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const d = snap.data() as any;
  return {
    uid,
    email: d.email ?? null,
    name: d.name ?? "",
    householdId: d.householdId ?? null,
    createdAt: Number(d.createdAt ?? Date.now()),
    updatedAt: Number(d.updatedAt ?? Date.now()),
  };
}

export async function ensureUserProfile(params: {
  uid: string;
  email: string | null;
}): Promise<UserProfile> {
  const existing = await getUserProfile(params.uid);
  if (existing) return existing;

  const now = Date.now();
  const ref = doc(db, "users", params.uid);

  const profile: UserProfile = {
    uid: params.uid,
    email: params.email,
    name: "", // will be set in /setup
    householdId: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, profile);
  return profile;
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<UserProfile>,
) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { ...patch, updatedAt: Date.now() });
}
