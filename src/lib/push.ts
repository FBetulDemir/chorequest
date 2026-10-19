// src/lib/push.ts
// Push notifications (Firebase Cloud Messaging) in the native app. Tokens are
// stored at users/{uid}/pushTokens/{token}; Cloud Functions in /functions send
// the messages.
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { deleteDoc, doc, setDoc } from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import { isNative } from "@/src/lib/native";

/**
 * Off until the native Firebase config files are added (see docs/MOBILE.md).
 * Registering without them would crash the Android app.
 */
export const PUSH_CONFIGURED = process.env.NEXT_PUBLIC_PUSH_ENABLED === "1";

const STORAGE_KEY = "cq-push-token";

export function pushSupported(): boolean {
  return isNative() && PUSH_CONFIGURED;
}

export function savedPushToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function tokenRef(uid: string, token: string) {
  return doc(db, "users", uid, "pushTokens", token);
}

/** Asks the OS for a push token, waiting for the registration callback. */
function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Push registration timed out"));
    }, 15_000);
    const ok = PushNotifications.addListener("registration", (t) => {
      cleanup();
      resolve(t.value);
    });
    const fail = PushNotifications.addListener("registrationError", (e) => {
      cleanup();
      reject(new Error(e.error));
    });
    function cleanup() {
      window.clearTimeout(timer);
      ok.then((h) => h.remove()).catch(() => {});
      fail.then((h) => h.remove()).catch(() => {});
    }
    PushNotifications.register().catch((e) => {
      cleanup();
      reject(e);
    });
  });
}

export type PushResult = "enabled" | "denied" | "unsupported" | "failed";

/**
 * Turns on push for this device. Without `prompt`, it only re-registers when
 * permission was already granted (used on app start to keep the token fresh).
 */
export async function enablePush(uid: string, { prompt = true } = {}): Promise<PushResult> {
  if (!pushSupported()) return "unsupported";
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted" && prompt) perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return "denied";

    const token = await requestToken();
    const previous = savedPushToken();
    if (previous && previous !== token) await deleteDoc(tokenRef(uid, previous)).catch(() => {});

    await setDoc(tokenRef(uid, token), {
      token,
      platform: Capacitor.getPlatform(),
      updatedAt: Date.now(),
    });
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch {
      // Without storage we just re-register next time
    }
    return "enabled";
  } catch {
    return "failed";
  }
}

export async function disablePush(uid: string): Promise<void> {
  const token = savedPushToken();
  if (token) await deleteDoc(tokenRef(uid, token)).catch(() => {});
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (isNative()) await PushNotifications.unregister().catch(() => {});
}
