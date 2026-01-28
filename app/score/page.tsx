// app/score/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";
import { listLedgerEntries } from "@/src/lib/points";
import type { PointsLedgerEntry } from "@/src/lib/types";
import { getRangeMs, type RangeKey } from "@/src/lib/ledgerHelpers";

type Row = {
  uid: string;
  name: string;
  points: number;
  chores: number;
  streak: number;
  topChore: string;
};

export default function ScorePage() {
  return (
    <RequireAuth>
      <ScoreInner />
    </RequireAuth>
  );
}

function ScoreInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);
  const [range, setRange] = useState<RangeKey>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      const p = await getUserProfile(uid);
      const hid = p?.householdId ?? null;
      setHouseholdId(hid);

      if (hid) {
        const mem = await listHouseholdMembers(hid);
        setMembers(mem);
      }
    }
    boot();
  }, [uid]);

  useEffect(() => {
    if (!householdId) return;

    async function load(hid: string) {
      setLoading(true);
      setError(null);
      try {
        const e = await listLedgerEntries(hid, 5000);
        setLedger(e);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load score");
      } finally {
        setLoading(false);
      }
    }

    load(householdId);
  }, [householdId]);

  const rows = useMemo(() => {
    const { startMs, endMs } = getRangeMs(range);

    // Only count completed entries by createdAt in the selected range
    const completionEvents = ledger.filter((e) => {
      const t = Number(e.createdAt ?? 0);
      if (!(t >= startMs && t < endMs)) return false;
      const reason = String(e.reason ?? "");
      const delta = Number(e.delta ?? 0);
      return reason.startsWith("Completed:") && delta > 0;
    });

    const byUid = new Map<
      string,
      {
        points: number;
        chores: number;
        choreNames: string[];
        completionDays: Set<string>;
      }
    >();

    for (const e of completionEvents) {
      const who = String(e.actorUid ?? "");
      const cur = byUid.get(who) ?? {
        points: 0,
        chores: 0,
        choreNames: [],
        completionDays: new Set<string>(),
      };
      cur.points += Number(e.delta ?? 0);
      cur.chores += 1;

      // Extract chore name from reason
      const reason = String(e.reason ?? "");
      const choreName = reason.replace("Completed: ", "");
      cur.choreNames.push(choreName);

      // Track completion day
      const dayKey =
        e.dayKey ?? new Date(Number(e.createdAt ?? 0)).toISOString().split("T")[0];
      cur.completionDays.add(dayKey);

      byUid.set(who, cur);
    }

    const nameOf = (u: string) =>
      members.find((m) => m.uid === u)?.name ?? "Member";

    // Calculate streak for a user
    const calculateStreak = (uid: string): number => {
      const userEvents = completionEvents
        .filter((e) => String(e.actorUid ?? "") === uid)
        .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));

      if (userEvents.length === 0) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();

      let streak = 0;
      let checkDate = new Date(todayMs);

      const daySet = new Set<string>();
      userEvents.forEach((e) => {
        const d = new Date(Number(e.createdAt ?? 0));
        d.setHours(0, 0, 0, 0);
        daySet.add(d.toISOString().split("T")[0]);
      });

      for (let i = 0; i < 30; i++) {
        const checkKey = checkDate.toISOString().split("T")[0];
        if (daySet.has(checkKey)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i === 0) {
          // Check yesterday if nothing today
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak;
    };

    // Get top chore for a user
    const getTopChore = (choreNames: string[]): string => {
      if (choreNames.length === 0) return "—";

      const counts = new Map<string, number>();
      choreNames.forEach((name) => {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      });

      let maxCount = 0;
      let topChore = "—";
      counts.forEach((count, name) => {
        if (count > maxCount) {
          maxCount = count;
          topChore = name;
        }
      });

      return topChore;
    };

    const computed: Row[] = [];

    // include all members (even 0)
    for (const m of members) {
      const v = byUid.get(m.uid) ?? {
        points: 0,
        chores: 0,
        choreNames: [],
        completionDays: new Set<string>(),
      };
      computed.push({
        uid: m.uid,
        name: m.name,
        points: v.points,
        chores: v.chores,
        streak: calculateStreak(m.uid),
        topChore: getTopChore(v.choreNames),
      });
    }

    // also include any actorUid not in members (edge case)
    for (const [u, v] of byUid.entries()) {
      if (!computed.some((r) => r.uid === u)) {
        computed.push({
          uid: u,
          name: nameOf(u),
          points: v.points,
          chores: v.chores,
          streak: calculateStreak(u),
          topChore: getTopChore(v.choreNames),
        });
      }
    }

    computed.sort((a, b) => b.points - a.points);
    return computed;
  }, [ledger, members, range]);

  const champion = rows[0];

  if (!householdId) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* header gradient card */}
      <div
        className="cq-card overflow-hidden relative"
        style={{
          background:
            "linear-gradient(90deg, #f59e0b 0%, #fb7185 45%, #a855f7 100%)",
        }}>
        <div className="p-6 text-white flex items-start justify-between">
          <div className="flex-1">
            <div className="text-2xl font-semibold">Leaderboard</div>
            <div className="opacity-90 text-sm">
              Who's crushing it this period?
            </div>

            {champion ? (
              <div className="mt-5 rounded-2xl bg-white/20 backdrop-blur-sm p-5 w-full max-w-[320px] border border-white/30">
                <div className="flex items-center gap-2">
                  <div className="text-sm opacity-90">Current Champion</div>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/30 text-lg">
                    👑
                  </div>
                </div>
                <div className="text-4xl font-bold mt-2 flex items-center gap-2">
                  {champion.name}
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xl font-bold shadow-lg">
                    #1
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                    <span className="font-semibold">{champion.points}</span>
                    <span className="opacity-90">points</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                    <span className="font-semibold">{champion.chores}</span>
                    <span className="opacity-90">chores</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-white/20 p-5 w-65">
                <div className="text-sm opacity-90">Current Champion</div>
                <div className="text-3xl font-bold mt-1">—</div>
                <div className="mt-2 text-sm opacity-90">
                  0 points • 0 chores
                </div>
              </div>
            )}
          </div>

          <div className="text-5xl shrink-0">🏆</div>
        </div>
      </div>

      {/* tabs */}
      <div className="grid grid-cols-3 gap-3">
        <TabButton active={range === "week"} onClick={() => setRange("week")}>
          This Week
        </TabButton>
        <TabButton active={range === "month"} onClick={() => setRange("month")}>
          This Month
        </TabButton>
        <TabButton active={range === "all"} onClick={() => setRange("all")}>
          All Time
        </TabButton>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      {/* ranking */}
      <div className="cq-card p-5">
        <div className="flex items-end justify-between">
          <div className="text-lg font-semibold">Ranking</div>
          <div className="text-sm text-gray-500">{members.length} members</div>
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((r, idx) => {
            const rankBadge =
              idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
            const isCurrentUser = r.uid === uid;

            return (
              <div
                key={r.uid}
                className={
                  "cq-card-soft p-4 transition " +
                  (idx === 0
                    ? "border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50"
                    : isCurrentUser
                      ? "border-2 border-purple-200 bg-purple-50/30"
                      : "")
                }>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-gray-100 font-bold text-gray-600 shrink-0">
                      {rankBadge ?? `#${idx + 1}`}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-base">
                          {r.name}
                        </div>
                        {isCurrentUser ? (
                          <span className="cq-pill text-xs">You</span>
                        ) : null}
                        {idx === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
                            👑 Champion
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 text-sm text-gray-500">
                        {r.chores} chores completed
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {r.streak > 0 ? (
                          <div className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-lg border border-orange-100">
                            <span>🔥</span>
                            <span className="font-semibold">{r.streak}</span>
                            <span>Streak</span>
                          </div>
                        ) : null}

                        {r.chores > 0 && r.topChore !== "—" ? (
                          <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100">
                            <span>✓</span>
                            <span className="font-medium truncate max-w-[120px]">
                              Top: {r.topChore.split(" ").slice(0, 3).join(" ")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-3xl font-bold text-purple-600">
                      {r.points}
                    </div>
                    <div className="text-xs text-gray-500">points</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* household stats */}
      <HouseholdStats rows={rows} />

      {/* achievements */}
      <Achievements rows={rows} />
    </div>
  );
}

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
        "rounded-2xl border px-5 py-4 text-center text-sm transition " +
        (active ? "text-white" : "bg-white")
      }
      style={
        active
          ? {
              background:
                "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
              borderColor: "transparent",
            }
          : { borderColor: "var(--cq-border)" }
      }>
      {children}
    </button>
  );
}

function HouseholdStats({
  rows,
}: {
  rows: { points: number; chores: number }[];
}) {
  const totalPoints = useMemo(
    () => rows.reduce((s, r) => s + r.points, 0),
    [rows],
  );
  const totalChores = useMemo(
    () => rows.reduce((s, r) => s + r.chores, 0),
    [rows],
  );

  return (
    <div className="cq-card p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span>📊</span>
        <span>Household Stats</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-sm text-gray-600">Total Chores Done</div>
          <div className="text-3xl font-bold mt-1 text-emerald-700">
            {totalChores}
          </div>
        </div>
        <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5">
          <div className="text-sm text-gray-600">Total Points</div>
          <div className="text-3xl font-bold mt-1 text-pink-700">
            {totalPoints}
          </div>
        </div>
      </div>
    </div>
  );
}

function Achievements({ rows }: { rows: Row[] }) {
  const achievements = useMemo(() => {
    if (rows.length === 0) return [];

    const result: {
      member: string;
      badge: string;
      title: string;
      emoji: string;
    }[] = [];

    // Find member with longest streak
    const maxStreakMember = rows.reduce((max, r) =>
      r.streak > max.streak ? r : max,
    );
    if (maxStreakMember && maxStreakMember.streak > 0) {
      result.push({
        member: maxStreakMember.name,
        badge: "🔥",
        title:
          maxStreakMember.streak >= 7
            ? "Consistency King"
            : maxStreakMember.streak >= 3
              ? "On Fire"
              : "Getting Started",
        emoji: "🔥",
      });
    }

    // Find member with most chores
    const maxChoresMember = rows.reduce((max, r) =>
      r.chores > max.chores ? r : max,
    );
    if (maxChoresMember && maxChoresMember.chores > 0) {
      result.push({
        member: maxChoresMember.name,
        badge: "💪",
        title:
          maxChoresMember.chores >= 20
            ? "Chore Champion"
            : maxChoresMember.chores >= 10
              ? "Hard Worker"
              : "Go-Getter",
        emoji: "💪",
      });
    }

    // Find top performer (most points)
    const topPerformer = rows[0];
    if (topPerformer && topPerformer.points > 0) {
      result.push({
        member: topPerformer.name,
        badge: "🏆",
        title: "Top Performer",
        emoji: "🏆",
      });
    }

    // Deduplicate achievements for the same member
    const uniqueAchievements = result.filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.member === item.member),
    );

    return uniqueAchievements.slice(0, 4);
  }, [rows]);

  if (achievements.length === 0) return null;

  return (
    <div className="cq-card p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span>🎯</span>
        <span>Achievements</span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {achievements.map((achievement, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{achievement.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-purple-900 truncate">
                  {achievement.member}
                </div>
                <div className="text-xs text-purple-700 font-medium mt-0.5">
                  {achievement.title}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
