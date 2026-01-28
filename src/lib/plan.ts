import { db } from "@/src/lib/firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { ChoreTemplate, Frequency } from "@/src/lib/types";

/**
 * IMPORTANT:
 * Set this to the collection your Today page writes to when you press "Complete".
 * Examples: "activity", "entries", "choreLogs", "completed", "choreEntries"
 */
export const COMPLETIONS_COLLECTION = "activity";

type Completion = {
  id: string;
  templateId?: string;
  title?: string;
  icon?: string;
  points?: number;
  frequency?: Frequency;
  completedAt?: number;
  completedByName?: string;
};

export function nextDueDates(
  template: ChoreTemplate,
  count = 3,
  fromMs = Date.now(),
): number[] {
  // Minimal scheduling:
  // - If you later store schedule details (dayOfWeek/dayOfMonth), we can improve this.
  const from = new Date(fromMs);

  const stepDays =
    template.frequency === "daily"
      ? 1
      : template.frequency === "weekly"
        ? 7
        : template.frequency === "monthly"
          ? 30
          : 90;

  // base anchor:
  const anchor = template.createdAt ? new Date(template.createdAt) : from;

  // find the first occurrence >= from
  const first = new Date(anchor);
  while (first.getTime() < from.getTime()) {
    first.setDate(first.getDate() + stepDays);
  }

  const out: number[] = [];
  const d = new Date(first);
  for (let i = 0; i < count; i++) {
    out.push(d.getTime());
    d.setDate(d.getDate() + stepDays);
  }
  return out;
}

export function formatDateShort(ms: number) {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function listRecentCompletions(
  householdId: string,
  frequency: Frequency,
  max = 10,
): Promise<Completion[]> {
  const col = collection(db, "households", householdId, COMPLETIONS_COLLECTION);

  // We try filtering by frequency if your docs store it.
  // If your completion docs don't have frequency, you'll still see items by removing the where().
  const q = query(
    col,
    where("frequency", "==", frequency),
    orderBy("completedAt", "desc"),
    limit(max),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      templateId: data.templateId,
      title: data.title,
      icon: data.icon,
      points: Number(data.points ?? 0),
      frequency: data.frequency,
      completedAt: Number(data.completedAt ?? data.createdAt ?? Date.now()),
      completedByName: data.completedByName ?? data.byName ?? data.userName,
    };
  });
}
