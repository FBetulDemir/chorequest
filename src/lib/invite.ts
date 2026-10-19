// src/lib/invite.ts
import type { Household } from "@/src/lib/types";

/**
 * Public web address of the app. Inside the native app the page origin is
 * capacitor://localhost, so links shared with others must use this instead.
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://chorequest-game.vercel.app").replace(/\/$/, "");

/** Link that opens the join screen with the code filled in (in the app, if installed). */
export function inviteUrl(code: string) {
  return `${APP_URL}/join?code=${encodeURIComponent(code)}`;
}

export function inviteMessage(household: Pick<Household, "name" | "code">) {
  return {
    title: "Join me on ChoreQuest",
    text: `Join our household "${household.name}" on ChoreQuest! 🏡 Tap the link, or enter code ${household.code} when you sign up.`,
    url: inviteUrl(household.code),
  };
}

/**
 * Turns a link the app was opened with into an in-app path, or null if it isn't ours.
 * Handles https://<app>/join?code=X and chorequest://join?code=X.
 */
export function pathFromAppLink(link: string): string | null {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return null;
  }
  if (u.protocol === "chorequest:") {
    // chorequest://join?code=X  ->  host "join"
    return `/${u.host}${u.pathname === "/" ? "" : u.pathname}${u.search}`;
  }
  if (u.origin === new URL(APP_URL).origin) return `${u.pathname}${u.search}`;
  return null;
}
