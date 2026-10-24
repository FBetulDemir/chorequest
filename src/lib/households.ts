import { auth, db } from "@/src/lib/firebase";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Household } from "@/src/lib/types";
import { ensureUserProfile } from "@/src/lib/profile";
import { memberUids } from "@/src/lib/members";
import { memberLimitReached, planFor } from "@/src/lib/plan";

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

/**
 * inviteCodes/{CODE} → { householdId }. Codes can be looked up by their exact
 * value but never listed, so knowing a code is what lets someone join.
 */
function inviteRef(code: string) {
  return doc(db, "inviteCodes", code);
}

function requireAuthUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  return uid;
}

/** Reserves a new, unused invite code for a household (the caller must be a member). */
async function claimInviteCode(hid: string, uid: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(6);
    const claimed = await runTransaction(db, async (tx) => {
      const snap = await tx.get(inviteRef(code));
      if (snap.exists()) return false; // taken, try another
      tx.set(inviteRef(code), { householdId: hid, createdBy: uid, createdAt: Date.now() });
      return true;
    });
    if (claimed) return code;
  }
  throw new Error("Couldn't create an invite code. Please try again.");
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
    code: "",
    createdAt: now,
    updatedAt: now,
    members: { [authUid]: true },
  };

  // Create household and link the profile first, so a failure below can't leave the user stuck
  await setDoc(hidRef, household);
  await updateDoc(userRef(authUid), {
    householdId: hidRef.id,
    updatedAt: now,
  });

  // Now that we're a member, reserve an invite code for it
  try {
    household.code = await claimInviteCode(hidRef.id, authUid);
    await updateDoc(hidRef, { code: household.code });
  } catch {
    // Invite codes refused (e.g. older security rules): ensureInviteCode fills it in later
  }

  return household;
}

/** Finds the household for a code: the invite document, or (for old codes) a direct lookup. */
async function householdIdForCode(code: string): Promise<string | null> {
  try {
    const invite = await getDoc(inviteRef(code));
    if (invite.exists()) return String(invite.get("householdId"));
  } catch {
    // Invite codes not readable (older security rules): fall back to the direct lookup
  }
  try {
    // Households created before invite documents existed. The security rules
    // no longer allow this query; it only helps until every household is migrated.
    const snap = await getDocs(query(collection(db, "households"), where("code", "==", code)));
    return snap.empty ? null : snap.docs[0].id;
  } catch {
    return null;
  }
}

export async function joinHouseholdByCode(params: {
  uid: string;
  code: string;
}): Promise<Household> {
  const authUid = requireAuthUid();
  const code = params.code.trim().toUpperCase();

  const hid = await householdIdForCode(code);
  if (!hid) throw new Error("Household code not found.");
  const now = Date.now();

  // 1) Join. The rules check that the code belongs to this household.
  await updateDoc(householdRef(hid), {
    [`members.${authUid}`]: true,
    lastJoinCode: code,
    updatedAt: now,
  });

  // 2) Now we can read it: respect the free plan's member limit
  const joined = await getHousehold(hid);
  if (!joined) throw new Error("Household disappeared after join.");
  const others = memberUids(joined.members).filter((u) => u !== authUid).length;
  if (memberLimitReached(planFor(joined), others)) {
    await updateDoc(householdRef(hid), { [`members.${authUid}`]: deleteField(), updatedAt: Date.now() });
    throw Object.assign(new Error("Household is full"), { code: "household-full" });
  }

  // 3) Link the profile
  await updateDoc(userRef(authUid), {
    householdId: hid,
    updatedAt: now,
  });

  return joined;
}

/**
 * Makes sure the household's code has an invite document. Households created
 * before invite documents existed get one the first time a member opens the app.
 */
export async function ensureInviteCode(household: Household, uid: string): Promise<void> {
  if (household.code) {
    const invite = await getDoc(inviteRef(household.code));
    if (invite.exists() && invite.get("householdId") === household.id) return;
    if (!invite.exists()) {
      const created = await runTransaction(db, async (tx) => {
        const snap = await tx.get(inviteRef(household.code));
        if (snap.exists()) return false;
        tx.set(inviteRef(household.code), { householdId: household.id, createdBy: uid, createdAt: Date.now() });
        return true;
      });
      if (created) return;
    }
  }
  // No code yet, or (very unlikely) it collides with another household's: get a fresh one
  const code = await claimInviteCode(household.id, uid);
  await updateDoc(householdRef(household.id), { code, updatedAt: Date.now() });
}

/** Replaces the invite code; the old one stops working. */
export async function regenerateInviteCode(household: Household, uid: string): Promise<string> {
  const code = await claimInviteCode(household.id, uid);
  await updateDoc(householdRef(household.id), { code, updatedAt: Date.now() });
  if (household.code) await deleteDoc(inviteRef(household.code)).catch(() => {});
  return code;
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
    plan: d.plan ?? null,
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
