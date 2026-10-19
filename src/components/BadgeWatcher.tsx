"use client";

import { useEffect, useMemo } from "react";

import { useHousehold } from "@/src/components/HouseholdProvider";
import { useFeedback } from "@/src/components/ui/Feedback";
import { badgesFor } from "@/src/lib/badges";

const storageKey = (uid: string) => `cq-badges-${uid}`;

/**
 * Announces badges the moment they're earned. The first run on a device just
 * records what's already earned, so old badges aren't announced again.
 */
export function BadgeWatcher() {
  const { uid, ledger, dataLoading } = useHousehold();
  const { toast, celebrate } = useFeedback();

  const earned = useMemo(
    () => (uid && !dataLoading ? badgesFor(ledger, uid).filter((b) => b.earned) : null),
    [uid, ledger, dataLoading],
  );

  useEffect(() => {
    if (!uid || !earned) return;
    let known: string[] | null = null;
    try {
      const raw = localStorage.getItem(storageKey(uid));
      known = raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return; // no storage: skip announcements rather than repeat them
    }

    const ids = earned.map((b) => b.id);
    if (known) {
      const fresh = earned.filter((b) => !known!.includes(b.id));
      for (const b of fresh) {
        toast(`${b.emoji} New badge: ${b.title}!`, { durationMs: 4500 });
      }
      if (fresh.length) celebrate({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    }
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(ids));
    } catch {
      // ignore
    }
  }, [uid, earned, toast, celebrate]);

  return null;
}
