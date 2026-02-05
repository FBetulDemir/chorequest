// app/today/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listChoreTemplates } from "@/src/lib/chores";
import { addLedgerEntry, listLedgerEntries } from "@/src/lib/points";
import type { ChoreTemplate, PointsLedgerEntry } from "@/src/lib/types";
import {
  buildOccurrences,
  startOfLocalDayMs,
} from "@/src/lib/schedule";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";

export default function TodayPage() {
  return (
    <RequireAuth>
      <TodayInner />
    </RequireAuth>
  );
}

function TodayInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const p = await getUserProfile(uid);
      setHouseholdId(p?.householdId ?? null);
    }
    loadProfile();
  }, [uid]);

  async function refresh(hid: string) {
    setError(null);
    setLoading(true);
    try {
      const [t, e, m] = await Promise.all([
        listChoreTemplates(hid),
        listLedgerEntries(hid, 2000),
        listHouseholdMembers(hid),
      ]);
      setTemplates(t);
      setLedger(e);
      setMembers(m);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!householdId) return;
    refresh(householdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  function hashStr(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function dayIndexFromDayKey(dayKey: string) {
    // Use noon to avoid DST edge weirdness.
    const d = new Date(`${dayKey}T12:00:00`);
    return Math.floor(d.getTime() / 86400000);
  }

  function getNameByUid(
    uid: string | undefined,
    members: { uid: string; name: string }[],
  ) {
    if (!uid) return null;
    return members.find((m) => m.uid === uid)?.name ?? null;
  }

  function getAssigneeForOccurrence(
    o: { templateId: string; dayKey: string; chore: any },
    members: { uid: string; name: string }[],
  ) {
    const mode = String(o.chore?.assigneeMode ?? "anyone");

    if (mode === "fixed") {
      const name = getNameByUid(o.chore?.fixedAssigneeUid, members);
      return name ? `🎯 ${name}` : "🎯 Fixed";
    }

    if (mode === "rotating") {
      if (!members.length) return "🔁 Rotating";
      const idx =
        (hashStr(o.templateId) + dayIndexFromDayKey(o.dayKey)) % members.length;
      return `🔁 ${members[idx].name}`;
    }

    return "👥 Anyone";
  }

  const nowMs = Date.now();

  // (ok to keep even if not used elsewhere; used to compute today window)
  const todayStartMs = useMemo(() => startOfLocalDayMs(nowMs), [nowMs]);
  const tomorrowStartMs = useMemo(
    () => todayStartMs + 24 * 3600 * 1000,
    [todayStartMs],
  );

  const entriesCreatedToday = useMemo(
    () =>
      ledger.filter((x) => {
        const c = Number(x.createdAt ?? 0);
        return c >= todayStartMs && c < tomorrowStartMs;
      }),
    [ledger, todayStartMs, tomorrowStartMs],
  );

  const completedToday = useMemo(() => {
    return entriesCreatedToday.filter(
      (x) =>
        String(x.reason ?? "").startsWith("Completed:") && Number(x.delta) > 0,
    );
  }, [entriesCreatedToday]);

  const pointsEarned = useMemo(() => {
    return entriesCreatedToday.reduce((sum, e) => {
      // Only count points for the current user
      if (e.actorUid !== uid) return sum;
      const r = String(e.reason ?? "");
      if (!r.startsWith("Completed:") && !r.startsWith("Undo:")) return sum;
      return sum + Number(e.delta ?? 0);
    }, 0);
  }, [entriesCreatedToday, uid]);

  // Hide chores that are completed/skipped FOR THEIR dayKey
  const statusByKey = useMemo(() => {
    const map = new Map<string, { completed: number; skipped: boolean }>();

    for (const e of ledger) {
      if (!e.templateId || !e.dayKey) continue;
      const key = `${e.templateId}__${e.dayKey}`;
      const cur = map.get(key) ?? { completed: 0, skipped: false };

      const r = String(e.reason ?? "");
      if (r.startsWith("Completed:") && Number(e.delta ?? 0) > 0)
        cur.completed += 1;
      if (r.startsWith("Undo:") && Number(e.delta ?? 0) < 0) cur.completed -= 1;
      if (r.startsWith("Skipped:")) cur.skipped = true;

      map.set(key, cur);
    }

    return map;
  }, [ledger]);

  const occurrences = useMemo(
    () => buildOccurrences(templates, nowMs, 10),
    [templates, nowMs],
  );

  const dueToday = useMemo(() => {
    return occurrences
      .filter((o) => o.bucket === "today")
      .filter((o) => {
        const key = `${o.templateId}__${o.dayKey}`;
        const st = statusByKey.get(key);
        if (!st) return true;
        if (st.skipped) return false;
        return st.completed <= 0;
      });
  }, [occurrences, statusByKey]);

  const next3 = useMemo(() => {
    return occurrences
      .filter((o) => o.bucket === "next3")
      .filter((o) => {
        const key = `${o.templateId}__${o.dayKey}`;
        const st = statusByKey.get(key);
        if (!st) return true;
        if (st.skipped) return false;
        return st.completed <= 0;
      });
  }, [occurrences, statusByKey]);

  // Show all non-daily chores with their next occurrence
  const recurringChores = useMemo(() => {
    const nonDaily = templates.filter(
      (t) => t.frequency !== "daily" && t.active,
    );

    return nonDaily.map((chore) => {
      // Find the next occurrence for this chore
      const nextOcc = occurrences.find(
        (o) => o.templateId === chore.id && o.bucket !== "today",
      );

      // Check if there's a "today" occurrence
      const todayOcc = occurrences.find(
        (o) => o.templateId === chore.id && o.bucket === "today",
      );

      // If there's a today occurrence and it's not completed, show that instead
      if (todayOcc) {
        const key = `${todayOcc.templateId}__${todayOcc.dayKey}`;
        const st = statusByKey.get(key);
        const isIncomplete = !st || (!st.skipped && st.completed <= 0);

        if (isIncomplete) {
          return {
            chore,
            nextDue: todayOcc.dayKey,
            dueStatus: "due-today",
            occurrence: todayOcc,
          };
        }
      }

      // Otherwise show the next occurrence
      return {
        chore,
        nextDue: nextOcc?.dayKey ?? "Not scheduled",
        dueStatus: nextOcc?.bucket === "next3" ? "coming-soon" : "upcoming",
        occurrence: nextOcc,
      };
    });
  }, [templates, occurrences, statusByKey]);

  async function complete(
    templateId: string,
    dayKey: string,
    chore: ChoreTemplate,
  ) {
    if (!householdId) return;

    const key = `${templateId}__${dayKey}`;
    setError(null);
    setBusyKey(key);

    try {
      const st = statusByKey.get(key);
      if (st && st.completed > 0) {
        setError("Already completed for this day.");
        return;
      }

      await addLedgerEntry(householdId, {
        actorUid: uid,
        delta: chore.points,
        reason: `Completed: ${chore.title}`,
        createdAt: Date.now(),
        templateId,
        dayKey,
      });

      const e = await listLedgerEntries(householdId, 2000);
      setLedger(e);
    } catch (e: any) {
      setError(e?.message ?? "Failed to complete");
    } finally {
      setBusyKey(null);
    }
  }

  async function skip(
    templateId: string,
    dayKey: string,
    chore: ChoreTemplate,
  ) {
    if (!householdId) return;

    const key = `${templateId}__${dayKey}`;
    setError(null);
    setBusyKey(key);

    try {
      const st = statusByKey.get(key);
      if (st?.skipped) {
        setError("Already skipped for this day.");
        return;
      }

      await addLedgerEntry(householdId, {
        actorUid: uid,
        delta: 0,
        reason: `Skipped: ${chore.title}`,
        createdAt: Date.now(),
        templateId,
        dayKey,
      });

      const e = await listLedgerEntries(householdId, 2000);
      setLedger(e);
    } catch (e: any) {
      setError(e?.message ?? "Failed to skip");
    } finally {
      setBusyKey(null);
    }
  }

  if (!householdId)
    return <div className="text-sm text-gray-500">Loading household...</div>;

  return (
    <div className="space-y-5">
      <div className="cq-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="cq-title">Today's Quest</div>
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

      <Section
        title="✨ Due Today"
        right={
          <button
            className="cq-btn"
            onClick={() => refresh(householdId)}
            disabled={loading}
            type="button">
            Refresh
          </button>
        }>
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : null}

        {!loading && dueToday.length === 0 ? (
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
                subtitle={`${o.dayKey} • ${o.chore.frequency} • ${getAssigneeForOccurrence(o, members)}`}
                points={o.chore.points}
                busy={busyKey === key}
                onComplete={() => complete(o.templateId, o.dayKey, o.chore)}
                onSkip={() => skip(o.templateId, o.dayKey, o.chore)}
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
                subtitle={`${o.dayKey} • ${o.chore.frequency} • ${getAssigneeForOccurrence(o, members)}`}
                points={o.chore.points}
                busy={busyKey === key}
                onComplete={() => complete(o.templateId, o.dayKey, o.chore)}
                onSkip={() => skip(o.templateId, o.dayKey, o.chore)}
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
              const key = `${item.occurrence.templateId}__${item.occurrence.dayKey}`;
              return (
                <OccurrenceCard
                  key={key}
                  title={item.chore.title}
                  subtitle={`${item.nextDue} • ${item.chore.frequency} • ${getAssigneeForOccurrence(item.occurrence, members)}`}
                  points={item.chore.points}
                  busy={busyKey === key}
                  onComplete={() =>
                    complete(
                      item.occurrence!.templateId,
                      item.occurrence!.dayKey,
                      item.occurrence!.chore,
                    )
                  }
                  onSkip={() =>
                    skip(
                      item.occurrence!.templateId,
                      item.occurrence!.dayKey,
                      item.occurrence!.chore,
                    )
                  }
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
                        ? getAssigneeForOccurrence(item.occurrence, members)
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
                      {String(e.reason ?? "").replace("Completed: ", "")}
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
