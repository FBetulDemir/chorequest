// app/score/history/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronDown, ChevronLeft } from "lucide-react";

import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { Avatar, Card, EmptyState, ListSkeleton } from "@/src/components/ui/Display";
import { scoresByMonth } from "@/src/lib/scoring";

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
  const { uid, members, ledger, dataLoading } = useReadyHousehold();
  // null = newest month open by default; "" = all collapsed
  const [openChoice, setOpenChoice] = useState<string | null>(null);

  const months = useMemo(() => scoresByMonth(ledger), [ledger]);
  const openMonth = openChoice ?? months[0]?.key ?? null;

  const memberOf = (u: string) => members.find((m) => m.uid === u);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/score" className="inline-flex items-center gap-1 text-sm font-bold text-brand-strong hover:underline">
          <ChevronLeft size={16} aria-hidden="true" /> Leaderboard
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Monthly scores</h1>
        <p className="text-sm text-muted">Every month&apos;s leaderboard, all in one place.</p>
      </div>

      {dataLoading ? <ListSkeleton rows={3} /> : null}

      {!dataLoading && months.length === 0 ? (
        <EmptyState
          mood="sleepy"
          title="No score history yet"
          description="Monthly totals show up here once chores are completed."
        />
      ) : null}

      <div className="space-y-3">
        {months.map((month) => {
          const isOpen = openMonth === month.key;
          const [y, m] = month.key.split("-").map(Number);
          const champion = month.members[0];
          const championMember = champion ? memberOf(champion.uid) : undefined;

          return (
            <Card key={month.key} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenChoice(isOpen ? "" : month.key)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2">
                {champion ? (
                  <Avatar
                    uid={champion.uid}
                    name={championMember?.name ?? "Former member"}
                    emoji={championMember?.avatar}
                    size={44}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-ink">
                    {MONTH_LABELS[m - 1]} {y}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {champion
                      ? `👑 ${champion.uid === uid ? "You" : (championMember?.name ?? "Former member")} won with ${champion.points} pts`
                      : "No activity"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-brand-strong">{month.totalPoints}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted">pts</div>
                </div>
                <ChevronDown size={18} className={clsx("text-faint transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
              </button>

              {isOpen ? (
                <div className="divide-y divide-line border-t border-line">
                  {month.members.map((s, idx) => {
                    const mem = memberOf(s.uid);
                    return (
                      <div key={s.uid} className={clsx("flex items-center gap-3 px-4 py-3", s.uid === uid && "bg-brand-soft")}>
                        <div className="w-6 text-center text-sm font-extrabold text-muted">
                          {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : idx + 1}
                        </div>
                        <Avatar uid={s.uid} name={mem?.name ?? "Former member"} emoji={mem?.avatar} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-ink">
                            {mem?.name ?? "Former member"}
                            {s.uid === uid ? <span className="cq-pill ml-2 px-2 py-0.5">You</span> : null}
                          </div>
                          <div className="text-xs text-muted">{s.chores} chores</div>
                        </div>
                        <div className="font-extrabold text-brand-strong">{s.points}</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
