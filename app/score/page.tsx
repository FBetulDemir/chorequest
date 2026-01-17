"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listLedgerEntries } from "@/src/lib/points";
import type { PointsLedgerEntry } from "@/src/types";
import { dayKeyFromTs, startOfDay } from "@/src/lib/schedule";

type RangeKey = "week" | "month" | "all";

type MemberRow = {
  uid: string;
  name: string;
  points: number;
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
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);
  const [range, setRange] = useState<RangeKey>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cache for profile names
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadProfile() {
      const p = await getUserProfile(uid);
      setHouseholdId(p?.householdId ?? null);
      if (p?.name) setNameMap((m) => ({ ...m, [uid]: p.name }));
    }
    loadProfile();
  }, [uid]);

  async function refresh(hid: string) {
    setError(null);
    setLoading(true);
    try {
      const entries = await listLedgerEntries(hid, 2000);
      setLedger(entries);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load score");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!householdId) return;
    refresh(householdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  // determine range start
  const rangeStart = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (range === "all") return 0;

    if (range === "month") {
      start.setDate(1);
      return start.getTime();
    }

    // week: Monday start (Sweden)
    // JS getDay(): 0=Sun..6=Sat -> we want Monday=0
    const day = start.getDay();
    const mondayIndex = (day + 6) % 7; // Mon=0, Tue=1, ... Sun=6
    start.setDate(start.getDate() - mondayIndex);
    return start.getTime();
  }, [range]);

  const filtered = useMemo(() => {
    return ledger.filter((e) => {
      if (e.delta <= 0) return false;
      if (range === "all") return true;
      return e.createdAt >= rangeStart;
    });
  }, [ledger, range, rangeStart]);

  // build member totals
  const rows: MemberRow[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      if (!e.actorUid) continue;
      map.set(e.actorUid, (map.get(e.actorUid) ?? 0) + e.delta);
    }

    const list: MemberRow[] = Array.from(map.entries()).map(([id, pts]) => ({
      uid: id,
      name: nameMap[id] ?? shortUid(id),
      points: pts,
    }));

    list.sort((a, b) => b.points - a.points);
    return list;
  }, [filtered, nameMap]);

  // load missing names (best effort)
  useEffect(() => {
    async function loadMissingNames() {
      const missing = Array.from(new Set(rows.map((r) => r.uid))).filter(
        (id) => !nameMap[id],
      );
      if (missing.length === 0) return;

      // getUserProfile reads from users/{uid}
      // We fetch in series to keep it simple (and avoid extra code).
      const updates: Record<string, string> = {};
      for (const id of missing) {
        try {
          const p = await getUserProfile(id);
          if (p?.name) updates[id] = p.name;
        } catch {
          // ignore
        }
      }
      if (Object.keys(updates).length) {
        setNameMap((m) => ({ ...m, ...updates }));
      }
    }
    loadMissingNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.uid).join("|")]);

  const totalPoints = useMemo(
    () => rows.reduce((s, r) => s + r.points, 0),
    [rows],
  );

  const titleRange =
    range === "week"
      ? "This Week"
      : range === "month"
        ? "This Month"
        : "All Time";

  if (!householdId)
    return <div className="text-sm text-gray-500">Loading household…</div>;

  return (
    <div className="space-y-5">
      <div className="cq-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="cq-title">Scoreboard</div>
            <div className="cq-subtitle">
              See who’s winning in your household
            </div>
          </div>
          <button
            className="cq-btn"
            onClick={() => refresh(householdId)}
            disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="mt-4 cq-card-soft p-3">
          <div className="grid grid-cols-3 gap-2">
            <RangeButton
              active={range === "week"}
              onClick={() => setRange("week")}>
              This Week
            </RangeButton>
            <RangeButton
              active={range === "month"}
              onClick={() => setRange("month")}>
              This Month
            </RangeButton>
            <RangeButton
              active={range === "all"}
              onClick={() => setRange("all")}>
              All Time
            </RangeButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat title="Range" value={titleRange} />
          <Stat title="Total points" value={String(totalPoints)} />
          <Stat title="Entries" value={String(filtered.length)} />
        </div>

        {error ? (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        ) : null}
      </div>

      <div className="cq-card-soft p-5">
        <div className="flex items-center justify-between">
          <div className="font-semibold">🏆 Leaderboard</div>
          <div className="text-xs text-gray-500">
            {range === "all"
              ? "All completions"
              : `From ${new Date(rangeStart).toLocaleDateString()}`}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : null}

          {!loading && rows.length === 0 ? (
            <div className="cq-card-soft p-8 text-center">
              <div className="text-2xl">🫧</div>
              <div className="mt-2 font-semibold">No scores yet</div>
              <div className="text-sm text-gray-500">
                Complete a chore to earn points and show up here.
              </div>
            </div>
          ) : null}

          {rows.map((r, idx) => (
            <div key={r.uid} className="cq-card-soft p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <RankBadge rank={idx + 1} />
                  <div>
                    <div className="font-semibold">
                      {r.name}{" "}
                      {r.uid === uid ? (
                        <span className="ml-2 cq-pill">You</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      {labelForRange(range, rangeStart)}
                    </div>
                  </div>
                </div>

                <div className="cq-pill">🪙 {r.points}</div>
              </div>

              <div className="mt-3">
                <ProgressBar
                  value={totalPoints > 0 ? r.points / totalPoints : 0}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cq-card-soft p-5">
        <div className="font-semibold">🧾 Recent activity</div>
        <div className="mt-3 space-y-2">
          {ledger.slice(0, 12).map((e) => (
            <div
              key={e.id}
              className="cq-card-soft p-3 flex items-center justify-between">
              <div className="text-sm">
                {e.reason.replace("Completed: ", "")}
                <div className="text-xs text-gray-500">
                  {new Date(e.createdAt).toLocaleString()} •{" "}
                  {nameMap[e.actorUid] ?? shortUid(e.actorUid)}
                </div>
              </div>
              <div className="cq-pill">+{e.delta}</div>
            </div>
          ))}
          {ledger.length === 0 ? (
            <div className="text-sm text-gray-500">No activity yet.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RangeButton({
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
      className={
        "rounded-xl border px-3 py-3 text-sm font-medium " +
        (active ? "text-white" : "bg-white")
      }
      style={
        active
          ? {
              borderColor: "transparent",
              background:
                "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
            }
          : { borderColor: "var(--cq-border)" }
      }
      onClick={onClick}
      type="button">
      {children}
    </button>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-4 bg-white/70"
      style={{ borderColor: "var(--cq-border)" }}>
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const emoji =
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🎯";
  return (
    <div
      className="h-10 w-10 rounded-xl grid place-items-center border bg-white/80"
      style={{ borderColor: "var(--cq-border)" }}>
      <div className="text-base">{emoji}</div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background:
            "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
        }}
      />
    </div>
  );
}

function shortUid(uid: string) {
  if (!uid) return "Unknown";
  return uid.slice(0, 6) + "…" + uid.slice(-4);
}

function labelForRange(range: RangeKey, rangeStart: number) {
  if (range === "all") return "All time totals";
  const start = new Date(rangeStart).toLocaleDateString();
  return `Totals since ${start}`;
}
