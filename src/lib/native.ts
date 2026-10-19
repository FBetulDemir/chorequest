// src/lib/native.ts
// One place for device features: native plugins inside the iOS/Android app,
// browser APIs (or nothing) on the web.
import { Capacitor } from "@capacitor/core";
import { Clipboard } from "@capacitor/clipboard";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";

export const isNative = () => Capacitor.isNativePlatform();

export type HapticStyle = "light" | "medium" | "success";

/** A short vibration or tap. Silently does nothing where it isn't supported. */
export function haptic(style: HapticStyle = "light") {
  if (isNative()) {
    const done =
      style === "success"
        ? Haptics.notification({ type: NotificationType.Success })
        : Haptics.impact({ style: style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
    done.catch(() => {});
    return;
  }
  try {
    navigator.vibrate?.(style === "success" ? [10, 40, 18] : style === "medium" ? 18 : 8);
  } catch {
    // Not supported (e.g. iOS Safari): fine.
  }
}

/** Copies text; returns false if the device wouldn't allow it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (isNative()) await Clipboard.write({ string: text });
    else await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/**
 * Opens the share sheet (native app or supporting browsers). Where sharing
 * isn't available, copies the message instead so it can be pasted in a chat.
 */
export async function shareText(opts: { title: string; text: string; url?: string }): Promise<ShareResult> {
  if (isNative()) {
    try {
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(opts);
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
      // Fall through to copying
    }
  }

  const copied = await copyText(opts.url ? `${opts.text}\n${opts.url}` : opts.text);
  return copied ? "copied" : "failed";
}
