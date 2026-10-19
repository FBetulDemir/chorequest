// app/today/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { recordCompletion, recordSkip } from "@/src/lib/points";
import { buildOccurrences, type Occurrence } from "@/src/lib/schedule";
import {
  buildStatusByOccurrence,
  entryTitle,
  isOccurrenceOpen,
  occurrenceKey,
  survivingCompletions,
} from "@/src/lib/ledgerHelpers";
import { assigneeLabel } from "@/src/lib/assignee";
import { friendlyError } from "@/src/lib/errors";
import { useTodayStartMs } from "@/src/lib/useToday";

export default function TodayPage() {
  return (
    <RequireAuth>
      <TodayInner />
    </RequireAuth>
  );
}

function TodayInner() {
  const { uid, householdId, members, templates, ledger, dataLoading } =
    useReadyHousehold();

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todayStartMs = useTodayStartMs();
  const tomorrowStartMs = useMemo(() => {
    const d = new Date(todayStartMs);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }, [todayStartMs]);

  const statusByKey = useMemo(() => buildStatusByOccurrence(ledger), [ledger]);

  // Completions made today that weren't undone, newest first
  const completedToday = useMemo(
    () =>
      survivingCompletions(ledger).filter((e) => {
        const c = Number(e.createdAt ?? 0);
        return c >= todayStartMs && c < tomorrowStartMs;
      }),
    [ledger, todayStartMs, tomorrowStartMs],
  );

  // Only count points for the current user
  const pointsEarned = useMemo(
    () =>
      completedToday
        .filter((e) => e.actorUid === uid)
        .reduce((sum, e) => sum + Number(e.delta ?? 0), 0),
    [completedToday, uid],
  );

  // Paused chores don't show up
  const activeTemplates = useMemo(
    () => templates.filter((t) => t.active),
    [templates],
  );

  const occurrences = useMemo(
    () => buildOccurrences(activeTemplates, todayStartMs, 10),
    [activeTemplates, todayStartMs],
  );

  // Hide chores that are completed/skipped FOR THEIR dayKey
  const openOccurrences = useMemo(
    () =>
      occurrences.filter((o) =>
        isOccurrenceOpen(statusByKey.get(occurrenceKey(o.templateId, o.dayKey))),
      ),
    [occurrences, statusByKey],
  );

  const dueToday = useMemo(
    () => openOccurrences.filter((o) => o.bucket === "today"),
    [openOccurrences],
  );

  const next3 = useMemo(
    () => openOccurrences.filter((o) => o.bucket === "next3"),
    [openOccurrences],
  );

  // Show all non-daily chores with their next occurrence
  const recurringChores = useMemo(() => {
    const nonDaily = activeTemplates.filter((t) => t.frequency !== "daily");

    return nonDaily.map((chore) => {
      const nextOcc = occurrences.find(
        (o) => o.templateId === chore.id && o.bucket !== "today",
      );

      // If there's an open occurrence today, show that instead
      const todayOpen = openOccurrences.find(
        (o) => o.templateId === chore.id && o.bucket === "today",
      );
      if (todayOpen) {
        return {
          chore,
          nextDue: todayOpen.dayKey,
          dueStatus: "due-today",
          occurrence: todayOpen,
        };
      }

      return {
        chore,
        nextDue: nextOcc?.dayKey ?? "Not scheduled",
        dueStatus: nextOcc?.bucket === "next3" ? "coming-soon" : "upcoming",
        occurrence: nextOcc,
      };
    });
  }, [activeTemplates, occurrences, openOccurrences]);

  async function run(key: string, action: () => Promise<void>) {
    setError(null);
    setBusyKey(key);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusyKey(null);
    }
  }

  function complete(o: Occurrence) {
    const key = occurrenceKey(o.templateId, o.dayKey);
    return run(key, () =>
      recordCompletion({
        householdId,
        uid,
        chore: o.chore,
        dayKey: o.dayKey,
        status: statusByKey.get(key),
      }),
    );
  }

  function skip(o: Occurrence) {
    const key = occurrenceKey(o.templateId, o.dayKey);
    return run(key, () =>
      recordSkip({
        householdId,
        uid,
        chore: o.chore,
        dayKey: o.dayKey,
        status: statusByKey.get(key),
      }),
    );
  }

  return (
    <div className="space-y-5">
      <div className="cq-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="cq-title">Today’s Quest</div>
            <div className="cq-subtitle">{new Date().toLocaleDateString()}</div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-semibold text-purple-600">
              {pointsEarned}
            </div>
            <div className="text-xs text-gray-500">points earned</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat
            title="Open"
            value={dueToday.length}
            icon="⏳"
            tone="bg-blue-50 text-blue-700 border-blue-100"
          />
          <Stat
            title="Done"
            value={completedToday.length}
            icon="✓"
            tone="bg-emerald-50 text-emerald-700 border-emerald-100"
          />
          <Stat
            title="Upcoming"
            value={next3.length}
            icon="📅"
            tone="bg-purple-50 text-purple-700 border-purple-100"
          />
        </div>

        {error ? (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        ) : null}
      </div>

      <Section title="✨ Due Today">
        {dataLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : null}

        {!dataLoading && dueToday.length === 0 ? (
          <div className="cq-card p-8 text-center">
            <div className="text-6xl mb-4">🎉✨</div>
            <div className="text-xl font-bold text-gray-900">All caught up!</div>
            <div className="text-sm text-gray-500 mt-2">
              No chores due today. Enjoy your free time!
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {dueToday.map((o) => {
            const key = `${o.templateId}__${o.dayKey}`;
            return (
              <OccurrenceCard
                key={key}
                title={o.chore.title}
                subtitle={`${o.dayKey} • ${o.chore.frequency} • ${assigneeLabel(o.chore, o.dayKey, members)}`}
                points={o.chore.points}
                busy={busyKey === key}
                onComplete={() => complete(o)}
                onSkip={() => skip(o)}
              />
            );
          })}
        </div>
      </Section>

      <Section title="📅 Next 3 Days">
        <div className="space-y-3">
          {next3.length === 0 ? (
            <div className="text-sm text-gray-500">Nothing upcoming.</div>
          ) : null}

          {next3.map((o) => {
            const key = `${o.templateId}__${o.dayKey}`;
            return (
              <OccurrenceCard
                key={key}
                title={o.chore.title}
                subtitle={`${o.dayKey} • ${o.chore.frequency} • ${assigneeLabel(o.chore, o.dayKey, members)}`}
                points={o.chore.points}
                busy={busyKey === key}
                onComplete={() => complete(o)}
                onSkip={() => skip(o)}
              />
            );
          })}
        </div>
      </Section>

      <Section title="🔁 Recurring Chores">
        <div className="space-y-3">
          {recurringChores.length === 0 ? (
            <div className="text-sm text-gray-500">
              No weekly, monthly, or seasonal chores.
            </div>
          ) : null}

          {recurringChores.map((item) => {
            const dueStatusEmoji =
              item.dueStatus === "due-today"
                ? "🔥"
                : item.dueStatus === "coming-soon"
                  ? "📅"
                  : "🗓️";

            const dueStatusText =
              item.dueStatus === "due-today"
                ? "Due today!"
                : item.dueStatus === "coming-soon"
                  ? "Coming soon"
                  : "Scheduled";

            // If due today, allow marking complete
            if (item.occurrence && item.dueStatus === "due-today") {
              const occ = item.occurrence;
              const key = occurrenceKey(occ.templateId, occ.dayKey);
              return (
                <OccurrenceCard
                  key={key}
                  title={item.chore.title}
                  subtitle={`${item.nextDue} • ${item.chore.frequency} • ${assigneeLabel(occ.chore, occ.dayKey, members)}`}
                  points={item.chore.points}
                  busy={busyKey === key}
                  onComplete={() => complete(occ)}
                  onSkip={() => skip(occ)}
                />
              );
            }

            // Otherwise just show info
            return (
              <div
                key={item.chore.id}
                className="cq-card-soft p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="text-2xl">{dueStatusEmoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">
                      {item.chore.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {dueStatusText} • Next: {item.nextDue} •{" "}
                      {item.chore.frequency} •{" "}
                      {item.occurrence
                        ? assigneeLabel(
                            item.occurrence.chore,
                            item.occurrence.dayKey,
                            members,
                          )
                        : "Not scheduled"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold shrink-0">
                  <span>🪙</span>
                  <span>{item.chore.points}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="✅ Completed Today">
        <div className="space-y-2">
          {completedToday.length === 0 ? (
            <div className="text-sm text-gray-500">No activity yet.</div>
          ) : null}

          {completedToday.slice(0, 20).map((e) => {
            const actorName =
              members.find((m) => m.uid === e.actorUid)?.name ?? "Someone";
            const time = new Date(Number(e.createdAt ?? 0)).toLocaleTimeString(
              [],
              { hour: "2-digit", minute: "2-digit" },
            );

            return (
              <div
                key={e.id}
                className="cq-card-soft p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="text-2xl">✓</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {entryTitle(e)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Completed by {actorName} • {time}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0">
                  <span>+{e.delta}</span>
                  <span>pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-gray-900">{title}</div>
        {right ?? null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Stat({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon?: string;
  tone: string;
}) {
  return (
    <div className={"rounded-xl border p-3 text-center " + tone}>
      {icon ? <div className="text-lg mb-1">{icon}</div> : null}
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80 font-medium mt-1">{title}</div>
    </div>
  );
}

function OccurrenceCard({
  title,
  subtitle,
  points,
  busy,
  onComplete,
  onSkip,
}: {
  title: string;
  subtitle: string;
  points: number;
  busy: boolean;
  onComplete: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="cq-card p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-base truncate">{title}</div>
          <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
        </div>
        <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold shrink-0">
          <span>🪙</span>
          <span>{points}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          className="
  w-full inline-flex items-center justify-center gap-2
  rounded-xl px-4 py-3 text-sm font-semibold text-white
  bg-gradient-to-r from-emerald-500 to-green-500
  shadow-sm shadow-emerald-200/50
  hover:from-emerald-600 hover:to-green-600
  hover:shadow-md hover:shadow-emerald-200/60
  active:scale-[0.98]
  transition-all duration-150
  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-sm
"
          onClick={onComplete}
          disabled={busy}
          type="button">
          {busy ? "..." : `✓ Complete (+${points} pts)`}
        </button>

        <button
          className="
  inline-flex items-center justify-center gap-2
  rounded-xl px-4 py-3 text-sm font-medium
  bg-white text-gray-700
  border border-gray-200
  shadow-sm
  hover:bg-gray-50 hover:text-gray-900
  active:scale-[0.98]
  transition-all duration-150
  disabled:opacity-60 disabled:cursor-not-allowed
"
          onClick={onSkip}
          disabled={busy}
          type="button">
          Skip
        </button>
      </div>
    </div>
  );
}
