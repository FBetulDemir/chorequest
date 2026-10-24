"use client";

import React, { useRef, useState } from "react";
import clsx from "clsx";
import { Check, SkipForward } from "lucide-react";

import { Spinner } from "@/src/components/ui/Button";
import { Avatar, PointsPill } from "@/src/components/ui/Display";
import { choreParts } from "@/src/lib/choreCatalog";
import { haptic } from "@/src/lib/native";
import type { HouseholdMember } from "@/src/lib/members";
import type { ChoreTemplate } from "@/src/lib/types";

const COMPLETE_TRIGGER = 90; // px to the right that completes the chore
const COMPLETE_MAX = 140;
const SKIP_WIDTH = 96; // revealed Skip button when swiping left

function AssigneeChip({
  chore,
  assignee,
  isMe,
}: {
  chore: ChoreTemplate;
  assignee: HouseholdMember | null;
  isMe: boolean;
}) {
  if (!assignee) {
    return <span className="inline-flex items-center gap-1">👥 Anyone</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar uid={assignee.uid} name={assignee.name} emoji={assignee.avatar} size={18} />
      <span className={clsx(isMe && "font-bold text-brand-strong")}>{isMe ? "You" : assignee.name}</span>
      {chore.assigneeMode === "rotating" ? <span aria-label="takes turns">🔁</span> : null}
    </span>
  );
}

/**
 * A chore occurrence. On phones: swipe right to complete, swipe left to reveal Skip.
 * Buttons do the same for mouse, keyboard and screen-reader users.
 */
export function ChoreCard({
  chore,
  meta,
  assignee,
  currentUid,
  overdue = false,
  done = false,
  busy = false,
  onComplete,
  onSkip,
}: {
  chore: ChoreTemplate;
  /** Short context such as "Tomorrow" or "Was due Thu 15 Oct" */
  meta?: string;
  assignee: HouseholdMember | null;
  currentUid: string;
  overdue?: boolean;
  done?: boolean;
  busy?: boolean;
  onComplete?: (origin: { x: number; y: number }) => void;
  onSkip?: () => void;
}) {
  const { icon, name } = choreParts(chore);
  const checkRef = useRef<HTMLButtonElement>(null);
  const isMe = assignee?.uid === currentUid;
  const canAct = !done && !!onComplete;
  const canSkip = canAct && !!onSkip;

  // ----- Swipe handling -----
  const [revealed, setRevealed] = useState(false); // Skip button showing
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; base: number; active: boolean; crossed: boolean } | null>(null);
  const offset = dragOffset ?? (revealed ? -SKIP_WIDTH : 0);

  function checkOrigin() {
    const r = checkRef.current?.getBoundingClientRect();
    return r
      ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!canAct || busy || e.pointerType === "mouse") return; // mouse users click the buttons
    drag.current = { x: e.clientX, y: e.clientY, base: revealed ? -SKIP_WIDTH : 0, active: false, crossed: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      const horizontal = Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.5;
      if (horizontal && (mx > 0 || canSkip || d.base < 0)) {
        d.active = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > 10) {
        drag.current = null; // vertical scroll: let the page handle it
        return;
      } else {
        return;
      }
    }
    const next = Math.max(canSkip ? -(SKIP_WIDTH + 24) : 0, Math.min(COMPLETE_MAX, d.base + mx));
    // A small tick when the swipe passes the "complete" point
    if (next >= COMPLETE_TRIGGER && !d.crossed) {
      d.crossed = true;
      haptic("light");
    } else if (next < COMPLETE_TRIGGER) {
      d.crossed = false;
    }
    setDragOffset(next);
  }

  function endDrag() {
    const d = drag.current;
    drag.current = null;
    if (!d?.active || dragOffset === null) {
      setDragOffset(null);
      return;
    }
    const final = dragOffset;
    setDragOffset(null);
    if (final >= COMPLETE_TRIGGER) {
      setRevealed(false);
      onComplete?.(checkOrigin());
    } else {
      setRevealed(canSkip && final < -SKIP_WIDTH / 2);
    }
  }

  return (
    <div className="relative">
      {/* Revealed behind the card while swiping */}
      {offset > 0 ? (
        <div
          className="absolute inset-0 flex items-center rounded-[20px] bg-emerald-500 pl-5 text-white"
          style={{ opacity: Math.min(1, offset / COMPLETE_TRIGGER) }}
          aria-hidden="true">
          <Check size={26} strokeWidth={3} />
          <span className="ml-2 text-sm font-extrabold">{offset >= COMPLETE_TRIGGER ? "Release to complete" : "Complete"}</span>
        </div>
      ) : null}
      {offset < 0 && canSkip ? (
        <div className="absolute inset-0 flex justify-end overflow-hidden rounded-[20px] bg-gray-200">
          <button
            type="button"
            onClick={() => {
              setRevealed(false);
              onSkip?.();
            }}
            tabIndex={revealed ? 0 : -1}
            className="flex h-full flex-col items-center justify-center gap-1 text-xs font-extrabold text-gray-700"
            style={{ width: SKIP_WIDTH }}>
            <SkipForward size={20} aria-hidden="true" />
            Skip
          </button>
        </div>
      ) : null}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          // Tapping a card with Skip showing just closes it
          if (revealed) {
            e.stopPropagation();
            e.preventDefault();
            setRevealed(false);
          }
        }}
        className={clsx(
          "cq-card relative flex touch-pan-y select-none items-center gap-3 p-3 pr-2",
          dragOffset === null && "transition-transform duration-200",
          overdue && "ring-1 ring-amber-200",
          done && "opacity-70",
        )}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}>
        <span
          className={clsx(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl",
            overdue ? "bg-amber-50" : "bg-surface-2",
          )}
          aria-hidden="true">
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className={clsx("truncate font-extrabold text-ink", done && "line-through decoration-2")}>{name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            <AssigneeChip chore={chore} assignee={assignee} isMe={isMe} />
            {meta ? (
              <>
                <span aria-hidden="true" className="text-faint">·</span>
                <span className={clsx(overdue && "font-bold text-amber-700")}>{meta}</span>
              </>
            ) : null}
          </div>
        </div>

        <PointsPill points={chore.points} />

        {canSkip ? (
          <>
            {/* Desktop: visible skip button */}
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="hidden h-11 w-11 shrink-0 place-items-center rounded-full text-faint transition hover:bg-surface-2 hover:text-ink disabled:opacity-40 sm:grid"
              aria-label={`Skip ${name}`}
              title="Skip">
              <SkipForward size={18} />
            </button>
            {/* Phones: swipe left; screen readers still get a button */}
            <button type="button" onClick={onSkip} disabled={busy} className="sr-only sm:hidden">
              Skip {name}
            </button>
          </>
        ) : null}

        {done ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white" aria-label="Completed">
            <Check size={22} strokeWidth={3} />
          </span>
        ) : canAct ? (
          <button
            ref={checkRef}
            type="button"
            onClick={() => onComplete?.(checkOrigin())}
            disabled={busy}
            className="group grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-emerald-500 text-emerald-600 transition-all hover:bg-emerald-500 hover:text-white active:scale-90 active:bg-emerald-500 active:text-white disabled:opacity-60"
            aria-label={`Complete ${name} for ${chore.points} points`}>
            {busy ? <Spinner /> : <Check size={22} strokeWidth={3} className="opacity-40 transition group-hover:opacity-100 group-active:opacity-100" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
