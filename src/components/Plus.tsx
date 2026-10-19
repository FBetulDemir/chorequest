"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { useHousehold } from "@/src/components/HouseholdProvider";
import { Button, buttonClasses } from "@/src/components/ui/Button";
import { Sheet } from "@/src/components/ui/Sheet";
import { planFor, type PlanStatus } from "@/src/lib/plan";
import { useLocalEntitlement } from "@/src/lib/purchases";

/** The household's current plan, including a purchase on this device the server hasn't recorded yet. */
export function usePlan(): PlanStatus {
  const { household } = useHousehold();
  const local = useLocalEntitlement();
  return useMemo(() => planFor(household, { local }), [household, local]);
}

/** "This needs Plus" sheet, shown when a free household hits a limit. */
export function PlusPrompt({
  open,
  onClose,
  title,
  message,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button block onClick={onClose}>
            Not now
          </Button>
          <Link href="/plus" className={buttonClasses({ variant: "primary", block: true })} onClick={onClose}>
            <Sparkles size={16} aria-hidden="true" /> See Plus
          </Link>
        </div>
      }>
      <p className="text-sm text-muted">{message}</p>
    </Sheet>
  );
}

/** Small "Plus" badge for locked features. */
export function PlusBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-(image:--cq-gradient) px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
      <Sparkles size={10} aria-hidden="true" /> Plus
    </span>
  );
}
