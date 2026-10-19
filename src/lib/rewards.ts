// src/lib/rewards.ts
// Rewards shop. Members spend the coins they earned from chores on rewards the
// household defines. The leaderboard isn't affected; coins are a separate wallet.
//
// households/{hid}/rewards/{id}      { title, icon, cost, active, createdBy, createdAt, updatedAt }
// households/{hid}/redemptions/{id}  { rewardId, title, icon, cost, uid, status, createdAt, fulfilledBy?, fulfilledAt? }
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import type { Redemption, Reward } from "@/src/lib/types";

export const REWARD_ICONS = ["🎬", "🍳", "🛋️", "💆", "🍕", "😴", "🍦", "🎮", "📺", "🍷", "🌮", "☕", "🎁", "🧁", "🛁", "🎟️", "🏖️", "🍫"];

export const COST_PRESETS = [50, 100, 200, 300, 500, 1000];

export const STARTER_REWARDS: Omit<Reward, "id" | "createdBy" | "createdAt" | "active">[] = [
  { icon: "🎬", title: "Pick the movie", cost: 100 },
  { icon: "🛋️", title: "Skip one chore", cost: 150 },
  { icon: "🍕", title: "Choose what's for dinner", cost: 200 },
  { icon: "😴", title: "Sleep in, no questions asked", cost: 200 },
  { icon: "💆", title: "10-minute massage", cost: 250 },
  { icon: "🍳", title: "Breakfast in bed", cost: 300 },
];

const rewardsCol = (hid: string) => collection(db, "households", hid, "rewards");
const redemptionsCol = (hid: string) => collection(db, "households", hid, "redemptions");

function toReward(id: string, d: DocumentData): Reward {
  return {
    id,
    title: String(d.title ?? ""),
    icon: String(d.icon ?? "🎁"),
    cost: Number(d.cost ?? 0),
    active: d.active !== false,
    createdBy: String(d.createdBy ?? ""),
    createdAt: Number(d.createdAt ?? 0),
  };
}

function toRedemption(id: string, d: DocumentData): Redemption {
  return {
    id,
    rewardId: String(d.rewardId ?? ""),
    title: String(d.title ?? ""),
    icon: String(d.icon ?? "🎁"),
    cost: Number(d.cost ?? 0),
    uid: String(d.uid ?? ""),
    status: d.status === "fulfilled" ? "fulfilled" : "pending",
    createdAt: Number(d.createdAt ?? 0),
    fulfilledBy: d.fulfilledBy,
    fulfilledAt: d.fulfilledAt,
  };
}

export function subscribeRewards(hid: string, onData: (r: Reward[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(rewardsCol(hid), orderBy("cost", "asc")),
    (snap) => onData(snap.docs.map((d) => toReward(d.id, d.data())).filter((r) => r.active)),
    onError,
  );
}

export function subscribeRedemptions(hid: string, onData: (r: Redemption[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(redemptionsCol(hid), orderBy("createdAt", "desc"), limit(500)),
    (snap) => onData(snap.docs.map((d) => toRedemption(d.id, d.data()))),
    onError,
  );
}

export async function createReward(hid: string, uid: string, r: { title: string; icon: string; cost: number }) {
  const now = Date.now();
  await addDoc(rewardsCol(hid), { ...r, title: r.title.trim(), active: true, createdBy: uid, createdAt: now, updatedAt: now });
}

export async function updateReward(hid: string, id: string, r: { title: string; icon: string; cost: number }) {
  await updateDoc(doc(rewardsCol(hid), id), { ...r, title: r.title.trim(), updatedAt: Date.now() });
}

export async function deleteReward(hid: string, id: string) {
  await deleteDoc(doc(rewardsCol(hid), id));
}

export async function redeemReward(hid: string, uid: string, reward: Reward) {
  await addDoc(redemptionsCol(hid), {
    rewardId: reward.id,
    title: reward.title,
    icon: reward.icon,
    cost: reward.cost,
    uid,
    status: "pending",
    createdAt: Date.now(),
  });
}

export async function fulfillRedemption(hid: string, id: string, byUid: string) {
  await updateDoc(doc(redemptionsCol(hid), id), { status: "fulfilled", fulfilledBy: byUid, fulfilledAt: Date.now() });
}

/** Cancels a pending redemption; the coins go back to the wallet. */
export async function cancelRedemption(hid: string, id: string) {
  await deleteDoc(doc(redemptionsCol(hid), id));
}
