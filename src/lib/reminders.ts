// src/lib/reminders.ts
// Daily reminder as a local notification scheduled on the phone (no server needed).
// The setting is per device, so it lives in local storage.
import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "@/src/lib/native";

export const DAILY_REMINDER_ID = 1001;
const STORAGE_KEY = "cq-daily-reminder";

export type ReminderSettings = {
  enabled: boolean;
  time: string; // "HH:MM", local time
};

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: "18:00" };

export function remindersSupported(): boolean {
  return isNative();
}

export function loadReminder(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REMINDER;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      enabled: !!parsed.enabled,
      time: /^\d{2}:\d{2}$/.test(parsed.time ?? "") ? parsed.time! : DEFAULT_REMINDER.time,
    };
  } catch {
    return DEFAULT_REMINDER;
  }
}

function saveReminder(s: ReminderSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the schedule still applies until the app is reinstalled
  }
}

export type ApplyResult = "scheduled" | "off" | "denied" | "unsupported";

/** Saves the setting and (re)schedules or cancels the notification. */
export async function applyReminder(s: ReminderSettings): Promise<ApplyResult> {
  if (!remindersSupported()) return "unsupported";

  await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] }).catch(() => {});

  if (!s.enabled) {
    saveReminder(s);
    return "off";
  }

  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") {
    saveReminder({ ...s, enabled: false });
    return "denied";
  }

  const [hour, minute] = s.time.split(":").map(Number);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: DAILY_REMINDER_ID,
        title: "Time for today’s quests 🧹",
        body: "See what’s left and grab some points before the day is over.",
        schedule: { on: { hour, minute }, allowWhileIdle: true },
        extra: { path: "/today" },
      },
    ],
  });
  saveReminder(s);
  return "scheduled";
}
