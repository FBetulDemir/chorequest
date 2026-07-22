// app/score/history/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";
import { listLedgerEntries } from "@/src/lib/points";
import type { PointsLedgerEntry } from "@/src/lib/types";

type MemberTotal = {
  uid: string;
  name: string;
  points: number;
  chores: number;
};

type MonthGroup = {
  key: string; // "2026-07"
  label: string; // "July 2026"
  totalPoints: number;
  totalChores: number;
  members: MemberTotal[];
};

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ScoreHistoryPage() {
  return (
    <RequireAuth>
      <ScoreHistoryInner />
    </RequireAuth>
  );
}

function ScoreHistoryInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);

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
        const e = await listLedgerEntries(hid, 10000);
        setLedger(e);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load score history");
      } finally {
        setLoading(false);
      }
    }

    load(householdId);
  }, [householdId]);

  const nameOf = (u: string) =>
    members.find((m) => m.uid === u)?.name ?? "Member";

  const months = useMemo<MonthGroup[]>(() => {
    const completionEvents = ledger.filter((e) => {
      const reason = String(e.reason ?? "");
      const delta = Number(e.delta ?? 0);
      return reason.startsWith("Completed:") && delta > 0;
    });

    const byMonth = new Map<string, Map<string, MemberTotal>>();

    for (const e of completionEvents) {
      const t = Number(e.createdAt ?? 0);
      if (!t) continue;
      const d = new Date(t);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const byUid = byMonth.get(monthKey) ?? new Map<string, MemberTotal>();
      const who = String(e.actorUid ?? "");
      const cur = byUid.get(who) ?? {
        uid: who,
        name: nameOf(who),
        points: 0,
        chores: 0,
      };
      cur.points += Number(e.delta ?? 0);
      cur.chores += 1;
      byUid.set(who, cur);
      byMonth.set(monthKey, byUid);
    }

    const groups: MonthGroup[] = [];
    for (const [key, byUid] of byMonth.entries()) {
      const [y, m] = key.split("-").map(Number);
      const memberTotals = Array.from(byUid.values()).sort(
        (a, b) => b.points - a.points,
      );
      groups.push({
        key,
        label: `${MONTH_LABELS[m - 1]} ${y}`,
        totalPoints: memberTotals.reduce((s, r) => s + r.points, 0),
        totalChores: memberTotals.reduce((s, r) => s + r.chores, 0),
        members: memberTotals,
      });
    }

    groups.sort((a, b) => (a.key < b.key ? 1 : -1));
    return groups;
  }, [ledger, members]);

  useEffect(() => {
    if (months.length > 0 && openMonth === null) {
      setOpenMonth(months[0].key);
    }
  }, [months, openMonth]);

  if (!householdId) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="cq-card p-5 flex items-start justify-between">
        <div>
          <div className="cq-title">Monthly Score History</div>
          <div className="cq-subtitle">Every month's leaderboard, all in one place</div>
          {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
        </div>

        <Link href="/score" className="cq-btn text-sm">
          ← Back to Score
        </Link>
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      {!loading && months.length === 0 ? (
        <div className="cq-card p-8 text-center">
          <div className="text-5xl mb-3">📆</div>
          <div className="font-semibold text-gray-700">No score history yet</div>
          <div className="text-sm text-gray-500 mt-1">
            Monthly totals will show up here once chores are completed
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {months.map((month) => {
          const isOpen = openMonth === month.key;
          const champion = month.members[0];

          return (
            <div key={month.key} className="cq-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenMonth(isOpen ? null : month.key)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-gray-50/50 transition">
                <div>
                  <div className="text-lg font-semibold">{month.label}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {champion ? `👑 ${champion.name} led with ${champion.points} pts` : "No activity"}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xl font-bold text-purple-600">
                      {month.totalPoints}
                    </div>
                    <div className="text-xs text-gray-500">total points</div>
                  </div>
                  <div className="text-gray-400">{isOpen ? "▲" : "▼"}</div>
                </div>
              </button>

              {isOpen ? (
                <div className="px-5 pb-5 space-y-2 border-t border-gray-100 pt-4">
                  {month.members.map((m, idx) => {
                    const rankBadge =
                      idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                    const isCurrentUser = m.uid === uid;

                    return (
                      <div
                        key={m.uid}
                        className={
                          "cq-card-soft p-3 flex items-center justify-between " +
                          (isCurrentUser ? "border-2 border-purple-200 bg-purple-50/30" : "")
                        }>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 text-center font-semibold text-gray-600 shrink-0">
                            {rankBadge}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {m.name}
                              {isCurrentUser ? (
                                <span className="cq-pill text-xs ml-2">You</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-gray-500">
                              {m.chores} chores completed
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-purple-600">{m.points}</div>
                          <div className="text-xs text-gray-500">points</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
