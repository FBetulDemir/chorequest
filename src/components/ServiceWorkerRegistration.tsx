"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Registration failing only means no offline support; the app still works.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
