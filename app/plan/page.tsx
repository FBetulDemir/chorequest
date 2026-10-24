"use client";

import React, { useMemo, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";

import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { ChoreCard } from "@/src/components/ChoreCard";
import { useChoreActions } from "@/src/components/useChoreActions";
import { EmptyState, ListSkeleton, Segmented } from "@/src/components/ui/Display";
import { buildOccurrences, type Occurrence } from "@/src/lib/schedule";
import { isOccurrenceDone, occurrenceKey } from "@/src/lib/ledgerHelpers";
import { createAssigneeResolver } from "@/src/lib/assignee";
import { friendlyDay } from "@/src/lib/dates";
import { FREQUENCIES, FREQUENCY_LABEL } from "@/src/lib/choreCatalog";
import { useTodayStartMs } from "@/src/lib/useToday";
import type { Frequency } from "@/src/lib/types";

type ViewMode = "upcoming" | "completed";
type Freq = Frequency | "all";

const HORIZON_DAYS = 30;

export default function PlanPage() {
  return (
    <RequireAuth>
      <PlanInner />
    </RequireAuth>
  );
}

function PlanInner() {
  const { uid, members, templates, ledger, dataLoading } = useReadyHousehold();
  const { statusByKey, busyKey, complete, skip } = useChoreActions();

  const [freq, setFreq] = useState<Freq>("all");
  const [view, setView] = useState<ViewMode>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");

  const todayStartMs = useTodayStartMs();

  // Next 30 days of active chores, soonest first, without skipped ones
  const occurrencesAll = useMemo(
    () =>
      buildOccurrences(
        templates.filter((t) => t.active),
        todayStartMs,
        HORIZON_DAYS,
      ).filter((o) => !statusByKey.get(occurrenceKey(o.templateId, o.dayKey))?.skipped),
    [templates, todayStartMs, statusByKey],
  );

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return occurrencesAll.filter(
      (o) =>
        (freq === "all" || o.chore.frequency === freq) &&
        (!query || o.chore.title.toLowerCase().includes(query)),
    );
  }, [occurrencesAll, freq, searchQuery]);

  const isDone = (o: Occurrence) => isOccurrenceDone(statusByKey.get(occurrenceKey(o.templateId, o.dayKey)));

  // Fair rotation over everything still to do (not just what the filters show)
  const whoDoes = useMemo(
    () =>
      createAssigneeResolver({
        members,
        ledger,
        openOccurrences: occurrencesAll.filter(
          (o) => !isOccurrenceDone(statusByKey.get(occurrenceKey(o.templateId, o.dayKey))),
        ),
      }),
    [members, ledger, occurrencesAll, statusByKey],
  );
  const upcomingList = filtered.filter((o) => !isDone(o));
  const completedList = filtered.filter(isDone);
  const visible = view === "completed" ? completedList : upcomingList;

  // Group by day for headings
  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of visible) {
      const list = map.get(o.dayKey) ?? [];
      list.push(o);
      map.set(o.dayKey, list);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Plan ahead</h1>
        <p className="text-sm text-muted">The next {HORIZON_DAYS} days. Get ahead whenever you have time.</p>
      </div>

      {/* Search & filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input
            type="search"
            className="cq-input pl-10"
            placeholder="Search chores…"
            aria-label="Search chores"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="radiogroup" aria-label="Frequency">
          {(["all", ...FREQUENCIES] as Freq[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={freq === f}
              onClick={() => setFreq(f)}
              className={clsx(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
                freq === f ? "border-transparent bg-brand text-white" : "border-line bg-surface text-muted hover:text-ink",
              )}>
              {f === "all" ? "All" : FREQUENCY_LABEL[f]}
            </button>
          ))}
        </div>

        <Segmented<ViewMode>
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "upcoming", label: `To do · ${upcomingList.length}` },
            { value: "completed", label: `Done · ${completedList.length}` },
          ]}
        />
      </div>

      {dataLoading ? <ListSkeleton rows={4} /> : null}

      {!dataLoading && visible.length === 0 ? (
        <EmptyState
          mood={view === "completed" ? "thinking" : "celebrate"}
          title={view === "completed" ? "Nothing completed yet" : "All caught up!"}
          description={
            view === "completed"
              ? "Chores you finish ahead of time show up here."
              : searchQuery || freq !== "all"
                ? "No chores match your filters."
                : "There's nothing planned for the next 30 days."
          }
          compact
        />
      ) : null}

      {byDay.map(([dayKey, list]) => (
        <section key={dayKey} className="space-y-2.5" aria-label={friendlyDay(dayKey, todayStartMs)}>
          <div style={{ top: "calc(4rem + env(safe-area-inset-top))" }}
            className="sticky z-10 -mx-1 bg-canvas/90 px-1 py-1 text-xs font-extrabold uppercase tracking-wide text-muted backdrop-blur">
            {friendlyDay(dayKey, todayStartMs)}
          </div>
          {list.map((o) => {
            const key = occurrenceKey(o.templateId, o.dayKey);
            const assigneeId = whoDoes(o.chore, o.dayKey);
            return (
              <ChoreCard
                key={key}
                chore={o.chore}
                assignee={assigneeId ? (members.find((m) => m.uid === assigneeId) ?? null) : null}
                currentUid={uid}
                done={view === "completed"}
                busy={busyKey === key}
                onComplete={(origin) => complete({ chore: o.chore, dayKey: o.dayKey }, origin)}
                onSkip={() => skip({ chore: o.chore, dayKey: o.dayKey })}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}
