// src/lib/invite.ts
import type { Household } from "@/src/lib/types";

/**
 * Public web address of the app. Inside the native app the page origin is
 * capacitor://localhost, so links shared with others must use this instead.
 */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://chorequest-game.vercel.app").replace(/\/$/, "");

export function inviteMessage(household: Pick<Household, "name" | "code">) {
  return {
    title: "Join me on ChoreQuest",
    text: `Join our household "${household.name}" on ChoreQuest! Sign up at ${APP_URL} and enter the code ${household.code}`,
  };
}
