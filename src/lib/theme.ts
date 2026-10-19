"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/src/lib/themeScript";

export type ThemePreference = "system" | "light" | "dark";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("cq-theme-change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("cq-theme-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The saved theme preference and a setter that applies it immediately. */
export function useThemePreference() {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribe,
    readPreference,
    () => "system",
  );

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode): the choice lasts for this page view only.
      document.documentElement.dataset.theme =
        next === "dark" ||
        (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
          ? "dark"
          : "light";
    }
    window.dispatchEvent(new Event("cq-theme-change"));
  }, []);

  return { preference, setPreference };
}
