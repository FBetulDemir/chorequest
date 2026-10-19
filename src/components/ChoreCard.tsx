"use client";

import React, { useRef, useState } from "react";
import clsx from "clsx";
import { Check, SkipForward } from "lucide-react";

import { Spinner } from "@/src/components/ui/Button";
import { Avatar, PointsPill } from "@/src/components/ui/Display";
import { splitChoreTitle } from "@/src/lib/choreCatalog";
import type { HouseholdMember } from "@/src/lib/members";
import type { ChoreTemplate } from "@/src/lib/types";

const SWIPE_TRIGGER = 90;
const SWIPE_MAX = 140;

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
  /** Short context such as "Tomorrow" or "Due Thu 15 Oct" */
  meta?: string;
  assignee: HouseholdMember | null;
  currentUid: string;
  overdue?: boolean;
  done?: boolean;
  busy?: boolean;
  onComplete?: (origin: { x: number; y: number }) => void;
  onSkip?: () => void;
}) {
  const { icon, name } = splitChoreTitle(chore.title);
  const checkRef = useRef<HTMLButtonElement>(null);
  const isMe = assignee?.uid === currentUid;
  const canAct = !done && !!onComplete;

  // ----- Swipe right to complete -----
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);

  function checkOrigin() {
    const r = checkRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!canAct || busy) return;
    if (e.pointerType === "mouse") return; // swiping is for touch; mouse users click the check
    drag.current = { x: e.clientX, y: e.clientY, active: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (mx > 10 && Math.abs(mx) > Math.abs(my) * 1.5) {
        d.active = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > 10 || mx < -10) {
        drag.current = null; // vertical scroll or left swipe: let the page handle it
        return;
      }
    }
    if (d.active) setDx(Math.max(0, Math.min(SWIPE_MAX, mx)));
  }

  function endDrag() {
    const triggered = drag.current?.active && dx >= SWIPE_TRIGGER;
    drag.current = null;
    setDx(0);
    if (triggered) onComplete?.(checkOrigin());
  }

  return (
    <div className="relative">
      {/* Revealed while swiping */}
      {dx > 0 ? (
        <div
          className="absolute inset-0 flex items-center rounded-[20px] bg-emerald-500 pl-5 text-white"
          style={{ opacity: Math.min(1, dx / SWIPE_TRIGGER) }}
          aria-hidden="true">
          <Check size={26} strokeWidth={3} />
          <span className="ml-2 text-sm font-extrabold">{dx >= SWIPE_TRIGGER ? "Release to complete" : "Complete"}</span>
        </div>
      ) : null}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={clsx(
          "cq-card relative flex touch-pan-y select-none items-center gap-3 p-3 pr-2",
          dx === 0 && "transition-transform duration-200",
          overdue && "ring-1 ring-amber-200",
          done && "opacity-70",
        )}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}>
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

        {canAct && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-full text-faint transition hover:bg-surface-2 hover:text-ink disabled:opacity-40 sm:grid"
            aria-label={`Skip ${name}`}
            title="Skip">
            <SkipForward size={18} />
          </button>
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
            className="group grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-emerald-500 text-emerald-600 transition-all hover:bg-emerald-500 hover:text-white active:scale-90 disabled:opacity-60"
            aria-label={`Complete ${name} for ${chore.points} points`}>
            {busy ? <Spinner /> : <Check size={22} strokeWidth={3} className="opacity-40 transition group-hover:opacity-100" />}
          </button>
        ) : null}
      </div>

      {/* Phones: skip lives under the card to keep the row uncluttered */}
      {canAct && onSkip ? (
        <div className="mt-1 flex justify-end pr-2 sm:hidden">
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="rounded-lg px-2 py-0.5 text-[11px] font-bold text-faint hover:text-ink disabled:opacity-40"
            aria-label={`Skip ${name}`}>
            Skip
          </button>
        </div>
      ) : null}
    </div>
  );
}
