// app/score/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarRange, Flame, Share2 } from "lucide-react";

import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { Button } from "@/src/components/ui/Button";
import { Avatar, Card, EmptyState, ListRow, ListSkeleton, Segmented, SectionTitle } from "@/src/components/ui/Display";
import { getRangeMs, type RangeKey } from "@/src/lib/ledgerHelpers";
import { scoresInRange, streakFor } from "@/src/lib/scoring";
import { splitChoreTitle } from "@/src/lib/choreCatalog";
import type { HouseholdMember } from "@/src/lib/members";

type Row = {
  uid: string;
  name: string;
  avatar?: string | null;
  points: number;
  chores: number;
  streak: number;
  topChore: string | null;
};

const RANGE_LABEL: Record<RangeKey, string> = {
  week: "this week",
  month: "this month",
  all: "of all time",
};

export default function ScorePage() {
  return (
    <RequireAuth>
      <ScoreInner />
    </RequireAuth>
  );
}

function ScoreInner() {
  const { uid, members, ledger, dataLoading } = useReadyHousehold();
  const [range, setRange] = useState<RangeKey>("week");

  const rows = useMemo<Row[]>(() => {
    const { startMs, endMs } = getRangeMs(range);
    const scores = scoresInRange(ledger, startMs, endMs);
    const byUid = new Map<string, HouseholdMember>(members.map((m) => [m.uid, m]));

    // include all members (even 0), plus anyone who scored but has since left
    const uids = new Set([...members.map((m) => m.uid), ...scores.keys()]);
    return [...uids]
      .map((u) => {
        const s = scores.get(u);
        return {
          uid: u,
          name: byUid.get(u)?.name ?? "Former member",
          avatar: byUid.get(u)?.avatar,
          points: s?.points ?? 0,
          chores: s?.chores ?? 0,
          streak: streakFor(ledger, u),
          topChore: s?.topChore ?? null,
        };
      })
      .sort((a, b) => b.points - a.points || b.chores - a.chores);
  }, [ledger, members, range]);

  const anyPoints = rows.some((r) => r.points > 0);
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const totalChores = rows.reduce((s, r) => s + r.chores, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Leaderboard</h1>
        <p className="text-sm text-muted">Who&apos;s carrying the household {RANGE_LABEL[range]}?</p>
      </div>

      <Segmented<RangeKey>
        label="Time range"
        value={range}
        onChange={setRange}
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
          { value: "all", label: "All time" },
        ]}
      />

      {dataLoading ? <ListSkeleton rows={3} /> : null}

      {!dataLoading && members.length < 2 ? (
        <EmptyState
          mood="thinking"
          title="It's more fun together"
          description="Invite your partner or roommates to start a friendly competition."
          action={
            <Link href="/household">
              <Button variant="primary">
                <Share2 size={16} aria-hidden="true" /> Invite someone
              </Button>
            </Link>
          }
          compact
        />
      ) : null}

      {!dataLoading && anyPoints ? <Podium rows={rows.slice(0, 3)} currentUid={uid} /> : null}

      {!dataLoading && !anyPoints && members.length >= 2 ? (
        <EmptyState
          mood="sleepy"
          title="No points yet"
          description={`Nobody has completed a chore ${RANGE_LABEL[range]}. First one takes the lead!`}
          compact
        />
      ) : null}

      {/* Ranking */}
      {!dataLoading && rows.length > 0 ? (
        <section className="space-y-3" aria-labelledby="ranking-heading">
          <SectionTitle>
            <span id="ranking-heading">Ranking</span>
          </SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {rows.map((r, idx) => (
              <div key={r.uid} className={clsx("flex items-center gap-3 px-4 py-3", r.uid === uid && "bg-brand-soft")}>
                <div className="w-6 text-center text-sm font-extrabold text-muted">
                  {anyPoints && idx < 3 ? ["🥇", "🥈", "🥉"][idx] : idx + 1}
                </div>
                <Avatar uid={r.uid} name={r.name} emoji={r.avatar} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-ink">
                    {r.name}
                    {r.uid === uid ? <span className="cq-pill ml-2 px-2 py-0.5">You</span> : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                    <span>{r.chores} chores</span>
                    {r.streak > 0 ? (
                      <span className="inline-flex items-center gap-0.5 font-bold text-orange-700">
                        <Flame size={12} aria-hidden="true" /> {r.streak}
                      </span>
                    ) : null}
                    {r.topChore ? <span className="truncate">Loves {splitChoreTitle(r.topChore).name}</span> : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-brand-strong">{r.points}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted">pts</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {/* Household totals */}
      {!dataLoading && anyPoints ? (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-xs font-bold text-muted">Chores done</div>
            <div className="mt-1 text-3xl font-extrabold text-emerald-600">{totalChores}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-bold text-muted">Points earned</div>
            <div className="mt-1 text-3xl font-extrabold text-brand-strong">{totalPoints}</div>
          </Card>
        </div>
      ) : null}

      {!dataLoading ? <Achievements rows={rows} /> : null}

      <Card className="overflow-hidden">
        <ListRow
          href="/score/history"
          icon={<CalendarRange size={18} />}
          title="Monthly scores"
          description="See who won each month"
        />
      </Card>
    </div>
  );
}

function Podium({ rows, currentUid }: { rows: Row[]; currentUid: string }) {
  // Display order: 2nd, 1st, 3rd
  const order = [rows[1], rows[0], rows[2]];
  const style = [
    { height: "h-20", avatar: 56, medal: "🥈", tone: "from-gray-200 to-gray-100" },
    { height: "h-28", avatar: 72, medal: "🥇", tone: "from-amber-300 to-amber-100" },
    { height: "h-14", avatar: 48, medal: "🥉", tone: "from-orange-300 to-orange-100" },
  ];

  return (
    <Card className="relative overflow-hidden px-4 pb-0 pt-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-(image:--cq-gradient) opacity-10" />
      <div className="relative grid grid-cols-3 items-end gap-3">
        {order.map((r, i) =>
          r ? (
            <div key={r.uid} className="flex flex-col items-center">
              {i === 1 ? <div className="animate-bob text-2xl" aria-hidden="true">👑</div> : null}
              <Avatar uid={r.uid} name={r.name} emoji={r.avatar} size={style[i].avatar} ring className="shadow-lifted" />
              <div className="mt-2 max-w-full truncate text-sm font-extrabold text-ink">
                {r.uid === currentUid ? "You" : r.name}
              </div>
              <div className="text-xs font-bold text-muted">{r.points} pts</div>
              <div
                className={clsx(
                  "mt-2 grid w-full place-items-center rounded-t-2xl bg-linear-to-b text-2xl dark:opacity-80",
                  style[i].height,
                  style[i].tone,
                )}
                aria-hidden="true">
                {style[i].medal}
              </div>
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
    </Card>
  );
}

function Achievements({ rows }: { rows: Row[] }) {
  const badges = useMemo(() => {
    if (!rows.length) return [];
    const out: { uid: string; name: string; emoji: string; title: string }[] = [];

    const streaker = rows.reduce((a, b) => (b.streak > a.streak ? b : a));
    if (streaker.streak >= 2) {
      out.push({
        uid: streaker.uid,
        name: streaker.name,
        emoji: "🔥",
        title: streaker.streak >= 7 ? "Consistency king" : streaker.streak >= 3 ? "On fire" : "Getting started",
      });
    }

    const worker = rows.reduce((a, b) => (b.chores > a.chores ? b : a));
    if (worker.chores > 0) {
      out.push({
        uid: worker.uid,
        name: worker.name,
        emoji: "💪",
        title: worker.chores >= 20 ? "Chore champion" : worker.chores >= 10 ? "Hard worker" : "Go-getter",
      });
    }

    if (rows[0]?.points > 0) {
      out.push({ uid: rows[0].uid, name: rows[0].name, emoji: "🏆", title: "Top performer" });
    }
    return out;
  }, [rows]);

  if (!badges.length) return null;

  return (
    <section className="space-y-3" aria-labelledby="badges-heading">
      <SectionTitle>
        <span id="badges-heading">Badges</span>
      </SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {badges.map((b) => (
          <Card key={`${b.emoji}-${b.uid}`} className="flex items-center gap-3 p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl" aria-hidden="true">
              {b.emoji}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-ink">{b.title}</div>
              <div className="truncate text-xs text-muted">{b.name}</div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
