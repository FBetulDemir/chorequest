"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // The native apps ship their files with the app; a service worker would only serve stale copies.
    if (Capacitor.isNativePlatform()) return;
    // Registration failing only means no offline support; the app still works.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
