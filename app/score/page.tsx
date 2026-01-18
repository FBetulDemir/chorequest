// app/score/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";
import { listLedgerEntries } from "@/src/lib/points";
import type { PointsLedgerEntry } from "@/src/types";
import { getRangeMs, type RangeKey } from "@/src/lib/ledgerHelpers";

type Row = { uid: string; name: string; points: number; chores: number };

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

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const e = await listLedgerEntries(householdId, 5000);
        setLedger(e);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load score");
      } finally {
        setLoading(false);
      }
    }

    load();
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

    const byUid = new Map<string, { points: number; chores: number }>();
    for (const e of completionEvents) {
      const who = String(e.actorUid ?? "");
      const cur = byUid.get(who) ?? { points: 0, chores: 0 };
      cur.points += Number(e.delta ?? 0);
      cur.chores += 1;
      byUid.set(who, cur);
    }

    const nameOf = (u: string) =>
      members.find((m) => m.uid === u)?.name ?? "Member";

    const computed: Row[] = [];

    // include all members (even 0)
    for (const m of members) {
      const v = byUid.get(m.uid) ?? { points: 0, chores: 0 };
      computed.push({
        uid: m.uid,
        name: m.name,
        points: v.points,
        chores: v.chores,
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
        className="cq-card overflow-hidden"
        style={{
          background:
            "linear-gradient(90deg, #f59e0b 0%, #fb7185 45%, #a855f7 100%)",
        }}>
        <div className="p-6 text-white flex items-start justify-between">
          <div>
            <div className="text-2xl font-semibold">Leaderboard</div>
            <div className="opacity-90 text-sm">
              Who’s crushing it this period?
            </div>

            <div className="mt-5 rounded-2xl bg-white/20 p-5 w-[260px]">
              <div className="text-sm opacity-90">Current Champion</div>
              <div className="text-3xl font-bold mt-1">
                {champion ? champion.name : "—"}
              </div>
              <div className="mt-2 text-sm opacity-90">
                {champion
                  ? `${champion.points} points • ${champion.chores} chores`
                  : "0 points • 0 chores"}
              </div>
            </div>
          </div>

          <div className="text-3xl">🏆</div>
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
          {rows.map((r, idx) => (
            <div
              key={r.uid}
              className="cq-card-soft p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-8 text-center text-gray-500">{idx + 1}</div>
                <div>
                  <div className="font-semibold">
                    {r.name}{" "}
                    {r.uid === uid ? (
                      <span className="text-gray-500">(you)</span>
                    ) : null}
                  </div>
                  <div className="text-sm text-gray-500">
                    {r.chores} chores completed
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-bold text-purple-600">
                  {r.points}
                </div>
                <div className="text-sm text-gray-500">points</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* household stats */}
      <HouseholdStats rows={rows} />
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
      <div className="text-lg font-semibold">Household Stats</div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-emerald-50 p-5">
          <div className="text-sm text-gray-600">Total Chores Done</div>
          <div className="text-3xl font-bold mt-1">{totalChores}</div>
        </div>
        <div className="rounded-2xl border bg-pink-50 p-5">
          <div className="text-sm text-gray-600">Total Points</div>
          <div className="text-3xl font-bold mt-1">{totalPoints}</div>
        </div>
      </div>
    </div>
  );
}
