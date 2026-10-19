// src/lib/analytics.ts
// Anonymous usage stats via Firebase Analytics. Off until the user opts in
// (Profile → Privacy) and only active when a measurement ID is configured.
import { getAnalytics, isSupported, logEvent, setAnalyticsCollectionEnabled, type Analytics } from "firebase/analytics";
import { app } from "@/src/lib/firebase";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
const CONSENT_KEY = "cq-analytics-consent";

let instance: Promise<Analytics | null> | null = null;

export function analyticsAvailable(): boolean {
  return !!MEASUREMENT_ID;
}

export function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}

function load(): Promise<Analytics | null> {
  instance ??= (async () => {
    if (!MEASUREMENT_ID || !(await isSupported())) return null;
    return getAnalytics(app);
  })().catch(() => null);
  return instance;
}

export async function setAnalyticsConsent(on: boolean): Promise<void> {
  try {
    if (on) localStorage.setItem(CONSENT_KEY, "yes");
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Storage blocked: treated as no consent next time
  }
  if (!on && !instance) return; // never loaded, nothing to switch off
  const a = await load();
  if (a) setAnalyticsCollectionEnabled(a, on);
}

/** Logs an event, only with consent. Never throws. */
export function track(name: string, params?: Record<string, string | number>): void {
  if (!analyticsAvailable() || !hasAnalyticsConsent()) return;
  load()
    .then((a) => {
      if (a) logEvent(a, name, params);
    })
    .catch(() => {});
}
