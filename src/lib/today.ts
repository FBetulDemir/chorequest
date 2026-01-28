import type { ChoreTemplate } from "@/src/lib/types";

/**
 * Part 4 simple logic:
 * - "Today" = all active chores
 * - Later we’ll filter by frequency + due dates properly
 */
export function getTodayChores(templates: ChoreTemplate[]) {
  return templates.filter((c) => c.active);
}
