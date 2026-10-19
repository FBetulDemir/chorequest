// src/lib/purchases.ts
// In-app subscriptions through RevenueCat (StoreKit / Google Play Billing).
// Apple and Google require their own payment systems for digital features,
// so purchases only happen in the native apps.
"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import {
  PURCHASES_ERROR_CODE,
  Purchases,
  type CustomerInfo,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

import { PLUS_ENTITLEMENT, type LocalEntitlement } from "@/src/lib/plan";

const API_KEYS: Record<string, string | undefined> = {
  ios: process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY,
};

export function purchasesAvailable(): boolean {
  return !!API_KEYS[Capacitor.getPlatform()];
}

export function manageSubscriptionsUrl(): string {
  return Capacitor.getPlatform() === "android"
    ? "https://play.google.com/store/account/subscriptions"
    : "https://apps.apple.com/account/subscriptions";
}

// ---------- Entitlement known on this device ----------

let local: LocalEntitlement = null;
const listeners = new Set<() => void>();

function setFromCustomerInfo(info: CustomerInfo) {
  const ent = info.entitlements.active[PLUS_ENTITLEMENT];
  local = ent ? { active: true, until: ent.expirationDateMillis ?? null } : { active: false, until: null };
  listeners.forEach((l) => l());
}

export function useLocalEntitlement(): LocalEntitlement {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => local,
    () => null,
  );
}

// ---------- SDK calls ----------

let configuredFor: string | null = null;

async function ensureConfigured(uid: string) {
  if (configuredFor === uid) return;
  const apiKey = API_KEYS[Capacitor.getPlatform()];
  if (!apiKey) throw new Error("Purchases aren't set up on this platform");
  if (configuredFor === null) await Purchases.configure({ apiKey, appUserID: uid });
  else await Purchases.logIn({ appUserID: uid });
  configuredFor = uid;
}

/** Loads the current subscription state for this user (call on app start). */
export async function refreshEntitlement(uid: string): Promise<void> {
  if (!purchasesAvailable()) return;
  await ensureConfigured(uid);
  const { customerInfo } = await Purchases.getCustomerInfo();
  setFromCustomerInfo(customerInfo);
}

/** Subscription options from the current RevenueCat offering (e.g. monthly and annual). */
export async function loadPackages(uid: string): Promise<PurchasesPackage[]> {
  await ensureConfigured(uid);
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function buyPackage(uid: string, pkg: PurchasesPackage): Promise<"purchased" | "cancelled"> {
  await ensureConfigured(uid);
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    setFromCustomerInfo(customerInfo);
    return "purchased";
  } catch (e) {
    const err = e as { code?: string | number; userCancelled?: boolean | null };
    if (err.userCancelled || String(err.code) === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return "cancelled";
    throw e;
  }
}

/** Required by Apple: restores purchases made with the same store account. */
export async function restorePurchases(uid: string): Promise<boolean> {
  await ensureConfigured(uid);
  const { customerInfo } = await Purchases.restorePurchases();
  setFromCustomerInfo(customerInfo);
  return !!customerInfo.entitlements.active[PLUS_ENTITLEMENT];
}
