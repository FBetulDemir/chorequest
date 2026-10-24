// src/lib/choreCatalog.ts
import type { AssigneeMode, Frequency } from "@/src/lib/types";

export const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "seasonal"];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  seasonal: "Seasonal",
};

export const FREQUENCY_HINT: Record<Frequency, string> = {
  daily: "Every day",
  weekly: "Every 7 days",
  monthly: "Once a month",
  seasonal: "Every 3 months",
};

/** Point presets shown when creating a chore. */
export const EFFORT_LEVELS = [
  { points: 10, label: "Quick", hint: "A few minutes" },
  { points: 20, label: "Easy", hint: "~15 minutes" },
  { points: 30, label: "Medium", hint: "~30 minutes" },
  { points: 40, label: "Big", hint: "About an hour" },
  { points: 50, label: "Huge", hint: "A couple of hours" },
  { points: 60, label: "Epic", hint: "Half a day" },
];

// Organized emoji categories for chore icons
export const ICON_CATEGORIES: Record<string, string[]> = {
  Cleaning: ["🧹", "🧽", "🪣", "🧴", "🫧", "✨", "💨", "🪤"],
  Kitchen: ["🍽️", "🍳", "🥄", "🫕", "🧊", "🗑️", "♨️", "🧂"],
  Laundry: ["🧺", "👕", "👖", "🧦", "🧤", "☀️", "🧵"],
  Bathroom: ["🛁", "🚿", "🪥", "🧻", "🪠", "🧼", "🪒", "💊"],
  Bedroom: ["🛏️", "🛋️", "🪟", "🪞", "💡", "🧸", "📚", "🕯️"],
  Outdoor: ["🌿", "🪴", "🌱", "🌳", "🍂", "🚗", "🏠"],
  Pets: ["🐶", "🐱", "🐟", "🐦", "🦮", "🥣", "💩", "🦴"],
  Shopping: ["🛒", "📦", "💳", "📝", "🏪", "🛍️", "🥬", "🧃"],
  Maintenance: ["🔧", "🔨", "🔌", "🪛", "📐", "🧰", "🪜"],
  Other: ["📅", "⏰", "📞", "💰", "📬", "🎁", "🧯", "🗂️"],
};

export const AVATAR_EMOJIS = ["🦊", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🐧", "🐙", "🦄", "🐝", "🐢", "🐳", "🦉", "🐰", "🐻"];

export type StarterChore = {
  icon: string;
  title: string;
  points: number;
  frequency: Frequency;
  assigneeMode: AssigneeMode;
};

// Starter chore templates for new households
export const STARTER_CHORES: StarterChore[] = [
  { icon: "🍽️", title: "Do Dishes", points: 20, frequency: "daily", assigneeMode: "rotating" },
  { icon: "🧹", title: "Sweep Kitchen Floor", points: 10, frequency: "daily", assigneeMode: "anyone" },
  { icon: "🗑️", title: "Take Out Trash", points: 10, frequency: "daily", assigneeMode: "rotating" },
  { icon: "🪴", title: "Water Plants", points: 10, frequency: "daily", assigneeMode: "anyone" },
  { icon: "🧺", title: "Do Laundry", points: 30, frequency: "weekly", assigneeMode: "anyone" },
  { icon: "🧹", title: "Vacuum Living Room", points: 30, frequency: "weekly", assigneeMode: "rotating" },
  { icon: "🛁", title: "Clean Bathroom", points: 40, frequency: "weekly", assigneeMode: "rotating" },
  { icon: "🪟", title: "Wipe Windows", points: 30, frequency: "weekly", assigneeMode: "anyone" },
  { icon: "🛏️", title: "Change Bed Sheets", points: 20, frequency: "weekly", assigneeMode: "anyone" },
  { icon: "🛒", title: "Grocery Shopping", points: 40, frequency: "monthly", assigneeMode: "rotating" },
  { icon: "🚗", title: "Wash Car", points: 30, frequency: "monthly", assigneeMode: "anyone" },
  { icon: "🧊", title: "Defrost Freezer", points: 40, frequency: "monthly", assigneeMode: "anyone" },
];

/** Older format: emoji and name in one title string. Still used to recognise starter chores. */
export function choreTitle(icon: string, name: string): string {
  return `${icon} ${name.trim()}`;
}

/** Splits "🧹 Sweep floor" into its icon and name. Titles without an emoji get a default icon. */
export function splitChoreTitle(title: string): { icon: string; name: string } {
  const trimmed = title.trim();
  const space = trimmed.indexOf(" ");
  if (space > 0) {
    const first = trimmed.slice(0, space);
    // Treat the first word as the icon when it contains no letters or digits
    if (!/[\p{L}\p{N}]/u.test(first)) {
      return { icon: first, name: trimmed.slice(space + 1).trim() };
    }
  }
  return { icon: "✨", name: trimmed };
}

/** Icon and name of a chore, whether it stores them separately (new) or in the title (old). */
export function choreParts(chore: { title: string; icon?: string }): { icon: string; name: string } {
  if (chore.icon) return { icon: chore.icon, name: chore.title.trim() };
  return splitChoreTitle(chore.title);
}

/** "🧹 Sweep": how a chore is written in history entries and notifications. */
export function choreLabel(chore: { title: string; icon?: string }): string {
  const { icon, name } = choreParts(chore);
  return `${icon} ${name}`;
}
