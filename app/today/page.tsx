// app/today/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";

import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { ChoreCard } from "@/src/components/ChoreCard";
import { useChoreActions } from "@/src/components/useChoreActions";
import { buttonClasses } from "@/src/components/ui/Button";
import {
  Avatar,
  EmptyState,
  ListSkeleton,
  ProgressRing,
  Segmented,
  SectionTitle,
} from "@/src/components/ui/Display";
import { buildOccurrences, buildPastOccurrences, type Occurrence } from "@/src/lib/schedule";
import { entryTitle, isOccurrenceOpen, occurrenceKey, survivingCompletions } from "@/src/lib/ledgerHelpers";
import { createAssigneeResolver } from "@/src/lib/assignee";
import { streakFor } from "@/src/lib/scoring";
import { friendlyDay, greeting, longDate, timeOfDay } from "@/src/lib/dates";
import { splitChoreTitle } from "@/src/lib/choreCatalog";
import { useTodayStartMs } from "@/src/lib/useToday";

type Filter = "everyone" | "mine";

export default function TodayPage() {
  return (
    <RequireAuth>
      <TodayInner />
    </RequireAuth>
  );
}

function TodayInner() {
  const { uid, profile, members, templates, ledger, dataLoading } = useReadyHousehold();
  const { statusByKey, busyKey, complete, skip } = useChoreActions();
  const [filter, setFilter] = useState<Filter>("everyone");

  const todayStartMs = useTodayStartMs();
  const tomorrowStartMs = useMemo(() => {
    const d = new Date(todayStartMs);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }, [todayStartMs]);

  // Paused chores don't show up
  const activeTemplates = useMemo(() => templates.filter((t) => t.active), [templates]);

  const upcoming = useMemo(
    () => buildOccurrences(activeTemplates, todayStartMs, 3),
    [activeTemplates, todayStartMs],
  );

  const openOccurrences = useMemo(
    () => upcoming.filter((o) => isOccurrenceOpen(statusByKey.get(occurrenceKey(o.templateId, o.dayKey)))),
    [upcoming, statusByKey],
  );

  const dueToday = useMemo(() => openOccurrences.filter((o) => o.bucket === "today"), [openOccurrences]);

  // Missed weekly/monthly/seasonal chores, unless the chore is due again today
  const overdue = useMemo(() => {
    const dueTodayIds = new Set(upcoming.filter((o) => o.bucket === "today").map((o) => o.templateId));
    return buildPastOccurrences(activeTemplates, todayStartMs, 14).filter(
      (o) =>
        !dueTodayIds.has(o.templateId) &&
        isOccurrenceOpen(statusByKey.get(occurrenceKey(o.templateId, o.dayKey))),
    );
  }, [activeTemplates, upcoming, todayStartMs, statusByKey]);

  const comingUp = useMemo(() => {
    const byDay = new Map<string, Occurrence[]>();
    for (const o of openOccurrences) {
      if (o.bucket !== "next3") continue;
      const list = byDay.get(o.dayKey) ?? [];
      list.push(o);
      byDay.set(o.dayKey, list);
    }
    return [...byDay.entries()];
  }, [openOccurrences]);

  // Completions made today that weren't undone, newest first
  const completedToday = useMemo(
    () =>
      survivingCompletions(ledger).filter((e) => {
        const c = Number(e.createdAt ?? 0);
        return c >= todayStartMs && c < tomorrowStartMs;
      }),
    [ledger, todayStartMs, tomorrowStartMs],
  );

  const myPointsToday = completedToday
    .filter((e) => e.actorUid === uid)
    .reduce((sum, e) => sum + Number(e.delta ?? 0), 0);

  const streak = useMemo(() => streakFor(ledger, uid), [ledger, uid]);

  // Progress: chores due today that are done, out of all chores due today
  const todayKeys = useMemo(
    () => new Set(upcoming.filter((o) => o.bucket === "today").map((o) => occurrenceKey(o.templateId, o.dayKey))),
    [upcoming],
  );
  const doneForToday = [...todayKeys].filter((k) => (statusByKey.get(k)?.completed ?? 0) > 0).length;
  const totalToday = doneForToday + dueToday.length;
  const progress = totalToday ? doneForToday / totalToday : 0;

  // Fair rotation: who's next depends on who did it last
  const whoDoes = useMemo(
    () => createAssigneeResolver({ members, ledger, openOccurrences: [...overdue, ...openOccurrences] }),
    [members, ledger, overdue, openOccurrences],
  );

  const memberOf = (u: string | null) => (u ? (members.find((m) => m.uid === u) ?? null) : null);
  const firstName = (profile?.name ?? "").split(" ")[0];

  // "Just me" = assigned to me, or anyone can do it
  const visible = (o: Occurrence) => {
    if (filter === "everyone") return true;
    const id = whoDoes(o.chore, o.dayKey);
    return id === null || id === uid;
  };

  const shownOverdue = overdue.filter(visible);
  const shownToday = dueToday.filter(visible);

  function renderCard(o: Occurrence, meta?: string, isOverdue = false) {
    const key = occurrenceKey(o.templateId, o.dayKey);
    return (
      <ChoreCard
        key={key}
        chore={o.chore}
        meta={meta}
        assignee={memberOf(whoDoes(o.chore, o.dayKey))}
        currentUid={uid}
        overdue={isOverdue}
        busy={busyKey === key}
        onComplete={(origin) => complete({ chore: o.chore, dayKey: o.dayKey }, origin)}
        onSkip={() => skip({ chore: o.chore, dayKey: o.dayKey })}
      />
    );
  }

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="cq-card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-(image:--cq-gradient) opacity-15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <ProgressRing value={progress} size={84} stroke={9}>
            <div className="text-center leading-none">
              <div className="text-xl font-extrabold text-ink">
                {doneForToday}
                <span className="text-sm text-muted">/{totalToday}</span>
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted">done</div>
            </div>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-muted">{longDate(todayStartMs)}</div>
            <h1 className="mt-0.5 text-2xl font-extrabold leading-tight tracking-tight text-ink">
              {greeting()}
              {firstName ? `, ${firstName}` : ""} 👋
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700">
                🪙 {myPointsToday} pts today
              </span>
              {streak > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-extrabold text-orange-700">
                  <Flame size={13} aria-hidden="true" /> {streak}-day streak
                </span>
              ) : null}
              <Link
                href="/rewards"
                className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-extrabold text-brand-strong">
                🎁 Rewards
              </Link>
            </div>
          </div>
        </div>
      </section>

      {members.length > 1 ? (
        <Segmented<Filter>
          label="Show chores for"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "everyone", label: "Everyone" },
            { value: "mine", label: "Just me" },
          ]}
        />
      ) : null}

      {dataLoading ? <ListSkeleton rows={4} /> : null}

      {/* Overdue */}
      {!dataLoading && shownOverdue.length > 0 ? (
        <section className="space-y-3" aria-labelledby="overdue-heading">
          <SectionTitle>
            <span id="overdue-heading">⏰ Catch up</span>
          </SectionTitle>
          <div className="space-y-2.5">
            {shownOverdue.map((o) => renderCard(o, `Was due ${friendlyDay(o.dayKey, todayStartMs)}`, true))}
          </div>
        </section>
      ) : null}

      {/* Today */}
      {!dataLoading ? (
        <section className="space-y-3" aria-labelledby="today-heading">
          <SectionTitle>
            <span id="today-heading">✨ Today</span>
          </SectionTitle>
          {shownToday.length > 0 ? (
            <>
              <div className="space-y-2.5">{shownToday.map((o) => renderCard(o))}</div>
              <p className="text-center text-xs text-faint sm:hidden">Tip: swipe right to complete, left to skip</p>
            </>
          ) : templates.length === 0 ? (
            <EmptyState
              mood="thinking"
              title="Let’s add some chores"
              description="Pick from the starter pack or create your own on the Household tab."
              action={
                <Link href="/household#chores" className={buttonClasses({ variant: "primary" })}>
                  Add chores
                </Link>
              }
            />
          ) : (
            <EmptyState
              mood={completedToday.length ? "celebrate" : "sleepy"}
              title={completedToday.length ? "All done for today!" : "Nothing due today"}
              description={
                completedToday.length
                  ? "Amazing teamwork. Enjoy your free time 🎉"
                  : filter === "mine"
                    ? "Nothing for you today. Switch to “Everyone” to help out."
                    : "Put your feet up, or get ahead on what’s coming up below."
              }
              compact
            />
          )}
        </section>
      ) : null}

      {/* Coming up */}
      {!dataLoading && comingUp.length > 0 ? (
        <section className="space-y-3" aria-labelledby="upcoming-heading">
          <SectionTitle
            right={
              <Link href="/plan" className="text-xs font-bold text-brand-strong hover:underline">
                See plan →
              </Link>
            }>
            <span id="upcoming-heading">📅 Coming up</span>
          </SectionTitle>
          {comingUp.map(([dayKey, list]) => {
            const shown = list.filter(visible);
            if (!shown.length) return null;
            return (
              <div key={dayKey} className="space-y-2.5">
                <div className="px-1 text-xs font-extrabold uppercase tracking-wide text-muted">
                  {friendlyDay(dayKey, todayStartMs)}
                </div>
                {shown.map((o) => renderCard(o))}
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Done today */}
      {completedToday.length > 0 ? (
        <section className="space-y-3" aria-labelledby="done-heading">
          <SectionTitle>
            <span id="done-heading">✅ Done today</span>
          </SectionTitle>
          <div className="cq-card divide-y divide-line overflow-hidden">
            {completedToday.slice(0, 20).map((e) => {
              const who = memberOf(e.actorUid);
              const { icon, name } = splitChoreTitle(entryTitle(e));
              return (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl" aria-hidden="true">
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{name}</div>
                    <div className="text-xs text-muted">
                      {e.actorUid === uid ? "You" : (who?.name ?? "Someone")} · {timeOfDay(Number(e.createdAt))}
                    </div>
                  </div>
                  {who ? <Avatar uid={who.uid} name={who.name} emoji={who.avatar} size={28} /> : null}
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                    +{e.delta}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
