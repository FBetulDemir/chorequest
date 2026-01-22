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
  dayKeyFromTs,
  startOfLocalDayMs,
} from "@/src/lib/schedule";

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
      const [t, e] = await Promise.all([
        listChoreTemplates(hid),
        listLedgerEntries(hid, 2000),
      ]);
      setTemplates(t);
      setLedger(e);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function hashStr(s: string) {
    // small stable hash
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function dayIndexFromDayKey(dayKey: string) {
    // dayKey is YYYY-MM-DD (local). Use noon to avoid DST edge weirdness.
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

  useEffect(() => {
    if (!householdId) return;
    refresh(householdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const nowMs = Date.now();
  const dkToday = useMemo(() => dayKeyFromTs(nowMs), [nowMs]);

  // What you DID today should be based on createdAt, not dayKey
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
      const r = String(e.reason ?? "");
      if (!r.startsWith("Completed:") && !r.startsWith("Undo:")) return sum;
      return sum + Number(e.delta ?? 0);
    }, 0);
  }, [entriesCreatedToday]);

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
            tone="bg-blue-50 text-blue-700"
          />
          <Stat
            title="Done"
            value={completedToday.length}
            tone="bg-emerald-50 text-emerald-700"
          />
          <Stat
            title="Next 3 Days"
            value={next3.length}
            tone="bg-purple-50 text-purple-700"
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
            disabled={loading}>
            Refresh
          </button>
        }>
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : null}

        {!loading && dueToday.length === 0 ? (
          <div className="cq-card-soft p-8 text-center">
            <div className="text-2xl">🎉</div>
            <div className="mt-2 font-semibold">All caught up!</div>
            <div className="text-sm text-gray-500">
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
                subtitle={`${o.dayKey} • ${o.chore.frequency} • ${o.chore.assigneeMode}`}
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
                subtitle={`${o.dayKey} • ${o.chore.frequency} • ${o.chore.assigneeMode} `}
                points={o.chore.points}
                busy={busyKey === key}
                onComplete={() => complete(o.templateId, o.dayKey, o.chore)}
                onSkip={() => skip(o.templateId, o.dayKey, o.chore)}
              />
            );
          })}
        </div>
      </Section>

      <Section title="✅ Completed Today">
        <div className="space-y-2">
          {completedToday.length === 0 ? (
            <div className="text-sm text-gray-500">No activity yet.</div>
          ) : null}

          {completedToday.slice(0, 20).map((e) => (
            <div
              key={e.id}
              className="cq-card-soft p-3 flex items-center justify-between">
              <div className="text-sm">
                {String(e.reason ?? "").replace("Completed: ", "")}
              </div>
              <div className="cq-pill">+{e.delta}</div>
            </div>
          ))}
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
    <div className="cq-card-soft p-5">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        {right ?? null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Stat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: string;
}) {
  return (
    <div
      className={"rounded-xl border p-4 " + tone}
      style={{ borderColor: "var(--cq-border)" }}>
      <div className="text-xs opacity-80">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
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
    <div className="cq-card-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
        </div>
        <div className="cq-pill">🪙 {points}</div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="cq-btn-primary flex-1"
          onClick={onComplete}
          disabled={busy}>
          {busy ? "..." : `✓ Complete (+${points} pts)`}
        </button>
        <button
          className="cq-btn w-24"
          type="button"
          onClick={onSkip}
          disabled={busy}>
          Skip
        </button>
      </div>
    </div>
  );
}
