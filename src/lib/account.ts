// src/lib/account.ts
// Leaving a household and deleting an account (App Store guideline 5.1.1(v)).
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, type User } from "firebase/auth";
import { deleteDoc, deleteField, doc, updateDoc } from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { memberUids } from "@/src/lib/members";
import { disablePush } from "@/src/lib/push";
import { applyReminder, DEFAULT_REMINDER, remindersSupported } from "@/src/lib/reminders";
import { reauthenticateWithProvider } from "@/src/lib/socialAuth";
import type { Household } from "@/src/lib/types";

export type SignInMethod = "password" | "apple" | "google";

// While deleting, the missing profile must not be re-created by the "new account" logic
let deleting = false;
export function isDeletingAccount(): boolean {
  return deleting;
}

/** How the user signs in, which decides how they confirm their identity. */
export function signInMethod(user: User): SignInMethod {
  const ids = user.providerData.map((p) => p.providerId);
  if (ids.includes("password")) return "password";
  if (ids.includes("apple.com")) return "apple";
  return "google";
}

export function isOnlyMember(household: Pick<Household, "members">, uid: string): boolean {
  const uids = memberUids(household.members);
  return uids.length === 1 && uids[0] === uid;
}

/** Removes the user from their household; they go back to the setup screen to create or join one. */
export async function leaveHousehold(uid: string, householdId: string): Promise<void> {
  // Membership first, while the rules still see them as a member
  await updateDoc(doc(db, "households", householdId), {
    [`members.${uid}`]: deleteField(),
    updatedAt: Date.now(),
  });
  await updateDoc(doc(db, "users", uid), { householdId: null, updatedAt: Date.now() });
}

/**
 * Permanently deletes the account.
 *
 * The client removes what it can (device token, membership, profile, sign-in).
 * The `cleanupDeletedUser` Cloud Function then deletes leftovers, including the
 * whole household when the user was its only member.
 */
export async function deleteAccount(params: {
  user: User;
  household: Household | null;
  password?: string;
}): Promise<void> {
  const { user, household, password } = params;

  // 1) Recent sign-in is required to delete a Firebase user, so confirm identity first
  const method = signInMethod(user);
  if (method === "password") {
    if (!user.email || !password) throw Object.assign(new Error("Password required"), { code: "auth/missing-password" });
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else {
    await reauthenticateWithProvider(user, method);
  }

  deleting = true;
  try {
    await removeAccountData(user, household);
  } finally {
    deleting = false;
  }
}

async function removeAccountData(user: User, household: Household | null) {
  // 2) Device-only settings
  await disablePush(user.uid).catch(() => {});
  if (remindersSupported()) await applyReminder(DEFAULT_REMINDER).catch(() => {});

  // 3) Leave a shared household so others keep using it. A household the user is
  //    alone in stays linked, so the cleanup function can find and delete it.
  if (household && !isOnlyMember(household, user.uid)) {
    await updateDoc(doc(db, "households", household.id), {
      [`members.${user.uid}`]: deleteField(),
      updatedAt: Date.now(),
    });
  }

  // 4) Profile, then the sign-in itself
  await deleteDoc(doc(db, "users", user.uid));
  await deleteUser(user);
}
