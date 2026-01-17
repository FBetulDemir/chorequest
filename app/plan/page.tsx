"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listChoreTemplates } from "@/src/lib/chores";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";
import {
  addEntry,
  listEntriesByDateRange,
  type ChoreEntry,
} from "@/src/lib/entries";
import type { ChoreTemplate, Frequency } from "@/src/types";

const tabs: Frequency[] = ["daily", "weekly", "monthly", "seasonal"];

export default function PlanPage() {
  return (
    <RequireAuth>
      <PlanInner />
    </RequireAuth>
  );
}

function PlanInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [entries, setEntries] = useState<ChoreEntry[]>([]);
  const [tab, setTab] = useState<Frequency>("daily");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1) resolve household + members
  useEffect(() => {
    async function load() {
      const p = await getUserProfile(uid);
      const hid = p?.householdId ?? null;
      setHouseholdId(hid);

      if (hid) {
        const mem = await listHouseholdMembers(hid);
        setMembers(mem);
      }
    }
    load();
  }, [uid]);

  // 2) load templates + entries range
  useEffect(() => {
    if (!householdId) return;

    async function loadAll() {
      setLoading(true);
      setError(null);

      try {
        const t = await listChoreTemplates(householdId);
        setTemplates(t);

        // range: from yesterday to horizon end (depends on tab, but we fetch a safe max)
        const today = startOfDay(new Date());
        const from = addDays(today, -7);
        const to = addDays(today, 365);

        const fromKey = dateKey(from);
        const toKey = dateKey(to);

        const e = await listEntriesByDateRange(householdId, fromKey, toKey);
        setEntries(e);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load plan");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [householdId]);

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.active !== false),
    [templates],
  );

  // Map entries by (templateId + dateKey)
  const entryMap = useMemo(() => {
    const m = new Map<string, ChoreEntry>();
    for (const e of entries) {
      const k = `${e.templateId}__${e.dateKey}`;
      // if multiple, keep latest (createdAt)
      const prev = m.get(k);
      if (!prev || (e.createdAt ?? 0) > (prev.createdAt ?? 0)) m.set(k, e);
    }
    return m;
  }, [entries]);

  const horizonDays =
    tab === "daily"
      ? 14
      : tab === "weekly"
        ? 28
        : tab === "monthly"
          ? 180
          : 365;

  const planned = useMemo(() => {
    const today = startOfDay(new Date());
    const end = addDays(today, horizonDays);

    const relevant = activeTemplates.filter((t) => t.frequency === tab);

    const items: PlannedItem[] = [];

    for (const t of relevant) {
      const occurrences = buildOccurrences(t, today, end);
      for (const d of occurrences) {
        const dk = dateKey(d);
        const key = `${t.id}__${dk}`;
        const e = entryMap.get(key);

        items.push({
          key,
          template: t,
          date: d,
          dateKey: dk,
          entry: e ?? null,
        });
      }
    }

    // Sort upcoming soonest first, completed newest first later when splitting
    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    return items;
  }, [activeTemplates, tab, entryMap, horizonDays]);

  const split = useMemo(() => {
    const upcoming: PlannedItem[] = [];
    const completed: PlannedItem[] = [];

    for (const it of planned) {
      if (it.entry?.status === "completed" || it.entry?.status === "skipped")
        completed.push(it);
      else upcoming.push(it);
    }

    // completed: newest first
    completed.sort((a, b) => b.date.getTime() - a.date.getTime());

    return { upcoming, completed };
  }, [planned]);

  async function mark(it: PlannedItem, status: "completed" | "skipped") {
    if (!householdId) return;
    if (it.entry) return;

    setBusyKey(it.key);
    setError(null);

    try {
      const byName = members.find((m) => m.uid === uid)?.name ?? "You";
      const pts = Number(it.template.points ?? 0);

      const newEntry = {
        templateId: it.template.id,
        dateKey: it.dateKey,
        status,
        points: pts,
        byUid: uid,
        createdAt: Date.now(),
      } as const;

      const id = await addEntry(householdId, newEntry);

      setEntries((prev) => [{ id, ...newEntry }, ...prev]);

      setToast(
        status === "completed"
          ? `Done: "${it.template.title}" (+${pts} pts) by ${byName}`
          : `Skipped: "${it.template.title}"`,
      );
      window.setTimeout(() => setToast(null), 2200);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save entry");
    } finally {
      setBusyKey(null);
    }
  }

  if (!householdId)
    return <div className="text-sm text-gray-500">Loading household…</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="cq-card p-5">
        <div className="cq-title">Chore Calendar</div>
        <div className="cq-subtitle">
          Plan and organize your household tasks
        </div>

        <div className="mt-4 rounded-full border bg-white p-1 flex gap-1">
          {tabs.map((t) => (
            <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
              {t === "daily"
                ? "✨ Daily"
                : t === "weekly"
                  ? "📆 Weekly"
                  : t === "monthly"
                    ? "🗓️ Monthly"
                    : "🍂 Seasonal"}
            </TabButton>
          ))}
        </div>

        {error ? (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        ) : null}
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      {/* Upcoming */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 tracking-wide">
          UPCOMING & OPEN ({split.upcoming.length})
        </div>

        {split.upcoming.length === 0 ? (
          <div className="cq-card-soft p-4 text-sm text-gray-500">
            No upcoming chores in this tab.
          </div>
        ) : (
          split.upcoming.map((it) => (
            <PlanCard
              key={it.key}
              item={it}
              members={members}
              busy={busyKey === it.key}
              onComplete={() => mark(it, "completed")}
              onSkip={() => mark(it, "skipped")}
            />
          ))
        )}
      </div>

      {/* Completed */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-500 tracking-wide">
          COMPLETED (
          {
            split.completed.filter((x) => x.entry?.status === "completed")
              .length
          }
          )
        </div>

        {split.completed.length === 0 ? (
          <div className="cq-card-soft p-4 text-sm text-gray-500">
            No activity yet.
          </div>
        ) : (
          split.completed.map((it) => (
            <CompletedRow key={it.key} item={it} members={members} />
          ))
        )}
      </div>

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2">
          <div
            className="rounded-2xl border bg-white px-4 py-3 text-sm shadow-lg"
            style={{ borderColor: "var(--cq-border)" }}>
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- UI components ---------- */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 rounded-full px-3 py-2 text-sm transition " +
        (active ? "text-white" : "text-gray-600 hover:bg-gray-50")
      }
      style={
        active
          ? {
              background:
                "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
            }
          : {}
      }>
      {children}
    </button>
  );
}

function PlanCard({
  item,
  members,
  busy,
  onComplete,
  onSkip,
}: {
  item: PlannedItem;
  members: HouseholdMember[];
  busy: boolean;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const t = item.template;
  const assigneeText =
    t.assigneeMode === "fixed" && t.fixedAssigneeUid
      ? (members.find((m) => m.uid === t.fixedAssigneeUid)?.name ?? "Fixed")
      : t.assigneeMode === "rotating"
        ? "Rotating"
        : "Anyone can do";

  return (
    <div className="cq-card-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xl">{guessIcon(t.title)}</div>
            <div className="font-semibold truncate">{t.title}</div>
          </div>

          <div className="mt-1 text-xs text-gray-500 flex flex-wrap items-center gap-2">
            <span className="cq-pill">🗓️ {prettyDate(item.date)}</span>
            <span className="cq-pill">👥 {assigneeText}</span>
            <span className="cq-pill">⭐ {difficultyStars(t.points)}</span>
          </div>
        </div>

        <div className="cq-pill bg-emerald-50 text-emerald-700">
          🪙 {t.points} pts
        </div>
      </div>

      {/* action bar like your design */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onComplete}
          className="flex-1 rounded-lg text-white py-2 text-sm"
          style={{
            background: "linear-gradient(90deg, #22c55e, #16a34a)",
          }}>
          {busy ? "Working..." : `✓ Complete (+${t.points} pts)`}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className="cq-btn">
          ✕ Skip
        </button>
      </div>
    </div>
  );
}

function CompletedRow({
  item,
  members,
}: {
  item: PlannedItem;
  members: HouseholdMember[];
}) {
  const t = item.template;
  const e = item.entry!;
  const byName = members.find((m) => m.uid === e.byUid)?.name ?? "Someone";

  const bg = e.status === "completed" ? "bg-emerald-50" : "bg-gray-50";

  const icon = e.status === "completed" ? "✅" : "⏭️";

  return (
    <div className={"cq-card-soft p-4 " + bg}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-lg">{icon}</div>
            <div className="font-semibold truncate">{t.title}</div>
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {e.status === "completed"
              ? `Completed by ${byName} • +${e.points} pts`
              : `Skipped by ${byName}`}
            {" • "}
            {prettyDate(item.date)}
          </div>
        </div>

        <div className="cq-pill bg-white/70 text-gray-700">
          {e.status === "completed" ? `+${e.points}` : "Skipped"}
        </div>
      </div>
    </div>
  );
}

/* ---------- Planning logic ---------- */

type PlannedItem = {
  key: string; // templateId__dateKey
  template: ChoreTemplate;
  date: Date;
  dateKey: string;
  entry: ChoreEntry | null;
};

function buildOccurrences(t: ChoreTemplate, start: Date, end: Date): Date[] {
  const freq = t.frequency;

  // schedule is optional; we default to something reasonable
  const schedule = (t as any).schedule ?? {};

  if (freq === "daily") {
    const out: Date[] = [];
    let d = startOfDay(start);
    while (d <= end) {
      out.push(new Date(d));
      d = addDays(d, 1);
    }
    return out;
  }

  if (freq === "weekly") {
    const dow: number =
      typeof schedule.dayOfWeek === "number"
        ? schedule.dayOfWeek
        : start.getDay(); // default: today weekday

    const out: Date[] = [];
    let d = startOfDay(start);

    // move to next desired weekday (including today)
    while (d.getDay() !== dow) d = addDays(d, 1);

    while (d <= end) {
      out.push(new Date(d));
      d = addDays(d, 7);
    }
    return out;
  }

  if (freq === "monthly") {
    const dom: number =
      typeof schedule.dayOfMonth === "number" ? schedule.dayOfMonth : 1;

    const out: Date[] = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);

    while (cursor <= end) {
      const d = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        clampDayOfMonth(cursor.getFullYear(), cursor.getMonth(), dom),
      );
      if (d >= start && d <= end) out.push(startOfDay(d));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return out;
  }

  // seasonal
  const dom: number =
    typeof schedule.dayOfMonth === "number" ? schedule.dayOfMonth : 1;

  const months: number[] =
    Array.isArray(schedule.months) && schedule.months.length
      ? schedule.months
      : [1, 4, 7, 10]; // default quarterly

  const out: Date[] = [];
  let year = start.getFullYear();
  const endYear = end.getFullYear();

  for (let y = year; y <= endYear; y++) {
    for (const m1 of months) {
      const monthIndex = m1 - 1; // 1..12 -> 0..11
      const d = new Date(y, monthIndex, clampDayOfMonth(y, monthIndex, dom));
      const sd = startOfDay(d);
      if (sd >= start && sd <= end) out.push(sd);
    }
  }

  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
}

/* ---------- Helpers ---------- */

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function prettyDate(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function clampDayOfMonth(year: number, monthIndex: number, day: number) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, day), last);
}

function difficultyStars(points: number) {
  if (points <= 10) return "⭐";
  if (points <= 20) return "⭐⭐";
  if (points <= 30) return "⭐⭐⭐";
  if (points <= 40) return "⭐⭐⭐⭐";
  return "⭐⭐⭐⭐⭐";
}

// Optional: if you later store icon in templates, replace this.
// For now, we show a consistent emoji if title contains keywords.
function guessIcon(title: string) {
  const s = title.toLowerCase();
  if (s.includes("trash")) return "🗑️";
  if (s.includes("laundry")) return "🧺";
  if (s.includes("vacuum")) return "🧹";
  if (s.includes("shop") || s.includes("grocery")) return "🛒";
  if (s.includes("bath")) return "🛁";
  if (s.includes("car")) return "🚗";
  if (s.includes("window")) return "🪟";
  if (s.includes("dish")) return "🍽️";
  if (s.includes("bed")) return "🛏️";
  if (s.includes("dog")) return "🐶";
  if (s.includes("plant")) return "🪴";
  return "✅";
}
