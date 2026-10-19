// src/lib/native.ts
// One place for device features. Web fallbacks for now; the native shell adds real ones.

export type HapticStyle = "light" | "medium" | "success";

/** A short vibration. Silently does nothing where vibration isn't supported. */
export function haptic(style: HapticStyle = "light") {
  try {
    navigator.vibrate?.(style === "success" ? [10, 40, 18] : style === "medium" ? 18 : 8);
  } catch {
    // Not supported (e.g. iOS Safari): fine.
  }
}
