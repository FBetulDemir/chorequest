"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { useFeedback } from "@/src/components/ui/Feedback";
import { recordCompletion, recordSkip, recordUndo } from "@/src/lib/points";
import { buildStatusByOccurrence, entryOccurrenceKey, occurrenceKey } from "@/src/lib/ledgerHelpers";
import { splitChoreTitle } from "@/src/lib/choreCatalog";
import { friendlyError } from "@/src/lib/errors";
import type { ChoreTemplate, PointsLedgerEntry } from "@/src/lib/types";

type Target = { chore: ChoreTemplate; dayKey: string };

/**
 * Complete / skip / undo with the feedback around them: confetti, toasts and an
 * Undo action. Shared by Today and Plan.
 */
export function useChoreActions() {
  const { uid, householdId, ledger } = useReadyHousehold();
  const { toast, celebrate } = useFeedback();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const statusByKey = useMemo(() => buildStatusByOccurrence(ledger), [ledger]);

  // Toast actions run later; read the latest status, not the one from when the toast appeared
  const statusRef = useRef(statusByKey);
  useEffect(() => {
    statusRef.current = statusByKey;
  }, [statusByKey]);

  async function undo(entry: PointsLedgerEntry) {
    const key = entryOccurrenceKey(entry);
    try {
      await recordUndo({
        householdId,
        uid,
        completion: entry,
        status: key ? statusRef.current.get(key) : undefined,
      });
      toast("Undone");
    } catch (e) {
      toast(friendlyError(e, "Couldn't undo. Please try again."), { tone: "error" });
    }
  }

  async function complete(t: Target, origin?: { x: number; y: number }) {
    const key = occurrenceKey(t.chore.id, t.dayKey);
    setBusyKey(key);
    try {
      const entry = await recordCompletion({
        householdId,
        uid,
        chore: t.chore,
        dayKey: t.dayKey,
        status: statusRef.current.get(key),
      });
      if (origin) celebrate({ ...origin, points: t.chore.points });
      const { name } = splitChoreTitle(t.chore.title);
      toast(`Nice! +${t.chore.points} for ${name}`, {
        action: { label: "Undo", onClick: () => undo(entry) },
      });
    } catch (e) {
      toast(friendlyError(e), { tone: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  async function skip(t: Target) {
    const key = occurrenceKey(t.chore.id, t.dayKey);
    setBusyKey(key);
    try {
      await recordSkip({
        householdId,
        uid,
        chore: t.chore,
        dayKey: t.dayKey,
        status: statusRef.current.get(key),
      });
      toast(`Skipped ${splitChoreTitle(t.chore.title).name}`);
    } catch (e) {
      toast(friendlyError(e), { tone: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  return { statusByKey, busyKey, complete, skip, undo };
}
