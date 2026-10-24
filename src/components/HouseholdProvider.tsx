"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/components/AuthProvider";
import { ensureUserProfile } from "@/src/lib/profile";
import { isDeletingAccount } from "@/src/lib/account";
import { ensureInviteCode } from "@/src/lib/households";
import { loadMembers, memberUids, type HouseholdMember } from "@/src/lib/members";
import { subscribeChoreTemplates } from "@/src/lib/chores";
import { subscribeLedger } from "@/src/lib/points";
import { friendlyError } from "@/src/lib/errors";
import type { ChoreTemplate, Household, PointsLedgerEntry, UserProfile } from "@/src/lib/types";

type HouseholdContextValue = {
  uid: string | null;
  profile: UserProfile | null;
  household: Household | null;
  members: HouseholdMember[];
  templates: ChoreTemplate[];
  ledger: PointsLedgerEntry[]; // newest first
  /** True until the signed-in user's profile and household are known. */
  loading: boolean;
  /** True until chores and ledger have arrived for the household. */
  dataLoading: boolean;
  error: string | null;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

// Each piece of state remembers which key (uid / household id) it belongs to,
// so stale data from a previous user or household is never shown.
type Keyed<T> = { key: string; value: T; error?: string };

function toUserProfile(uid: string, d: DocumentData): UserProfile {
  return {
    uid,
    email: d.email ?? null,
    name: d.name ?? "",
    householdId: d.householdId ?? null,
    avatar: d.avatar ?? null,
    createdAt: Number(d.createdAt ?? Date.now()),
    updatedAt: Number(d.updatedAt ?? Date.now()),
  };
}

function toHousehold(id: string, d: DocumentData): Household {
  return {
    id,
    name: d.name ?? "Household",
    code: d.code ?? "",
    members: d.members ?? {},
    plan: d.plan ?? null,
    createdAt: Number(d.createdAt ?? Date.now()),
    updatedAt: Number(d.updatedAt ?? Date.now()),
  };
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const email = user?.email ?? null;

  const [profileState, setProfileState] = useState<Keyed<UserProfile | null> | null>(null);
  const [householdState, setHouseholdState] = useState<Keyed<Household | null> | null>(null);
  const [membersState, setMembersState] = useState<Keyed<HouseholdMember[]> | null>(null);
  const [templatesState, setTemplatesState] = useState<Keyed<ChoreTemplate[]> | null>(null);
  const [ledgerState, setLedgerState] = useState<Keyed<PointsLedgerEntry[]> | null>(null);

  // 1) Profile
  useEffect(() => {
    if (!uid) return;
    let creating = false;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (!snap.exists()) {
          // Brand-new account: create the profile so onboarding can continue.
          if (!creating && !isDeletingAccount()) {
            creating = true;
            ensureUserProfile({ uid, email }).catch((err) =>
              setProfileState({ key: uid, value: null, error: friendlyError(err, "Couldn't create your profile.") }),
            );
          }
          return;
        }
        setProfileState({ key: uid, value: toUserProfile(uid, snap.data()) });
      },
      (err) => setProfileState({ key: uid, value: null, error: friendlyError(err, "Couldn't load your profile.") }),
    );
  }, [uid, email]);

  const profileReady = !uid || profileState?.key === uid;
  const profile = uid && profileState?.key === uid ? profileState.value : null;
  const householdId = profile?.householdId ?? null;

  // 2) Household
  useEffect(() => {
    if (!householdId) return;
    return onSnapshot(
      doc(db, "households", householdId),
      (snap) =>
        setHouseholdState({
          key: householdId,
          value: snap.exists() ? toHousehold(snap.id, snap.data()) : null,
          error: snap.exists() ? undefined : "Your household could not be found.",
        }),
      (err) => setHouseholdState({ key: householdId, value: null, error: friendlyError(err, "Couldn't load your household.") }),
    );
  }, [householdId]);

  const householdReady = !householdId || householdState?.key === householdId;
  const household = householdId && householdState?.key === householdId ? householdState.value : null;

  // Older households: create the invite document for their code (once per session)
  const inviteChecked = useRef<string | null>(null);
  useEffect(() => {
    if (!uid || !household || inviteChecked.current === household.id) return;
    if (household.members[uid] !== true) return;
    inviteChecked.current = household.id;
    ensureInviteCode(household, uid).catch(() => {
      inviteChecked.current = null; // try again next time
    });
  }, [uid, household]);

  // 3) Members (reloaded whenever someone joins or leaves)
  const membersKey = household ? memberUids(household.members).join(",") : "";
  useEffect(() => {
    if (!membersKey) return;
    let cancelled = false;
    loadMembers(membersKey.split(",")).then((value) => {
      if (!cancelled) setMembersState({ key: membersKey, value });
    });
    return () => {
      cancelled = true;
    };
  }, [membersKey]);

  // 4) Chores and ledger
  useEffect(() => {
    if (!householdId) return;
    return subscribeChoreTemplates(
      householdId,
      (value) => setTemplatesState({ key: householdId, value }),
      (err) => setTemplatesState({ key: householdId, value: [], error: friendlyError(err, "Couldn't load chores.") }),
    );
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    return subscribeLedger(
      householdId,
      (value) => setLedgerState({ key: householdId, value }),
      (err) => setLedgerState({ key: householdId, value: [], error: friendlyError(err, "Couldn't load activity.") }),
    );
  }, [householdId]);

  const value = useMemo<HouseholdContextValue>(() => {
    const own = <T,>(s: Keyed<T> | null, key: string | null) => (key && s?.key === key ? s : null);

    // Show the user's own new name immediately after they change it.
    const rawMembers = own(membersState, membersKey)?.value ?? [];
    const members = profile?.name?.trim()
      ? rawMembers
          .map((m) =>
            m.uid === profile.uid ? { ...m, name: profile.name, avatar: profile.avatar ?? null } : m,
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      : rawMembers;

    const templates = own(templatesState, householdId);
    const ledger = own(ledgerState, householdId);

    const error =
      own(profileState, uid)?.error ??
      own(householdState, householdId)?.error ??
      templates?.error ??
      ledger?.error ??
      null;

    return {
      uid,
      profile,
      household,
      members,
      templates: templates?.value ?? [],
      ledger: ledger?.value ?? [],
      loading: authLoading || !profileReady || !householdReady,
      dataLoading: !!householdId && (!templates || !ledger),
      error,
    };
  }, [
    uid,
    profile,
    household,
    householdId,
    membersKey,
    membersState,
    templatesState,
    ledgerState,
    profileState,
    householdState,
    authLoading,
    profileReady,
    householdReady,
  ]);

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used within HouseholdProvider");
  return ctx;
}

/**
 * For pages behind RequireAuth, where a signed-in user with a household is guaranteed.
 */
export function useReadyHousehold() {
  const ctx = useHousehold();
  if (!ctx.uid || !ctx.household) {
    throw new Error("useReadyHousehold used before the household was ready");
  }
  return { ...ctx, uid: ctx.uid, household: ctx.household, householdId: ctx.household.id };
}
