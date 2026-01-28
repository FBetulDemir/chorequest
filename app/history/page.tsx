"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";
import { addLedgerEntry, listLedgerEntries } from "@/src/lib/points";
import type { PointsLedgerEntry } from "@/src/lib/types";

export default function HistoryPage() {
  return (
    <RequireAuth>
      <HistoryInner />
    </RequireAuth>
  );
}

function HistoryInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [items, setItems] = useState<PointsLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  async function refresh(hid: string) {
    setLoading(true);
    setError(null);
    try {
      const e = await listLedgerEntries(hid, 1000);
      setItems(e);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!householdId) return;
    refresh(householdId);
  }, [householdId]);

  const nameOf = (u: string) =>
    members.find((m) => m.uid === u)?.name ?? "Member";

  const rows = useMemo(() => {
    // show only meaningful stuff in UI
    return items.filter((x) => {
      const r = String(x.reason ?? "");
      return (
        r.startsWith("Completed:") ||
        r.startsWith("Skipped:") ||
        r.startsWith("Undo:")
      );
    });
  }, [items]);

  async function undo(e: PointsLedgerEntry) {
    if (!householdId) return;
    if (!e.templateId || !e.dayKey) return;
    if (!String(e.reason ?? "").startsWith("Completed:")) return;

    setBusyId(e.id);
    setError(null);

    try {
      await addLedgerEntry(householdId, {
        actorUid: uid,
        delta: -Math.abs(Number(e.delta ?? 0)),
        reason: `Undo: ${String(e.reason ?? "").replace("Completed: ", "")}`,
        createdAt: Date.now(),
        templateId: e.templateId,
        dayKey: e.dayKey,
      });

      await refresh(householdId);
    } catch (err: any) {
      setError(err?.message ?? "Failed to undo");
    } finally {
      setBusyId(null);
    }
  }

  if (!householdId)
    return <div className="text-sm text-gray-500">Loading household…</div>;

  return (
    <div className="space-y-5">
      <div className="cq-card p-5 flex items-start justify-between">
        <div>
          <div className="cq-title">History</div>
          <div className="cq-subtitle">Everything your household did</div>
          {error ? (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          ) : null}
        </div>

        <button
          className="cq-btn"
          onClick={() => refresh(householdId)}
          disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      <div className="space-y-3">
        {rows.map((e) => {
          const reason = String(e.reason ?? "");
          const who = nameOf(String(e.actorUid ?? ""));
          const ts = Number(e.createdAt ?? 0);
          const when = ts ? new Date(ts).toLocaleString() : "";

          const isCompleted = reason.startsWith("Completed:");
          const isSkipped = reason.startsWith("Skipped:");
          const isUndo = reason.startsWith("Undo:");

          const icon = isCompleted ? "✓" : isSkipped ? "⏭️" : "↩️";
          const badgeColor = isCompleted
            ? "bg-emerald-100 text-emerald-700"
            : isSkipped
              ? "bg-gray-100 text-gray-700"
              : "bg-amber-100 text-amber-700";

          return (
            <div key={e.id} className="cq-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 border border-gray-100 shrink-0 text-lg">
                    {icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-base truncate">
                      {reason
                        .replace("Completed: ", "")
                        .replace("Skipped: ", "")
                        .replace("Undo: ", "")}
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {who} • {when}
                    </div>

                    <div className="mt-2">
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold " +
                          badgeColor
                        }>
                        {isCompleted
                          ? "Completed"
                          : isSkipped
                            ? "Skipped"
                            : "Undone"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {Number(e.delta ?? 0) !== 0 ? (
                    <div
                      className={
                        "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold " +
                        (Number(e.delta ?? 0) > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700")
                      }>
                      {Number(e.delta ?? 0) > 0
                        ? `+${e.delta}`
                        : `${e.delta}`}{" "}
                      pts
                    </div>
                  ) : null}

                  {isCompleted ? (
                    <button
                      className="cq-btn"
                      type="button"
                      onClick={() => undo(e)}
                      disabled={busyId === e.id}>
                      {busyId === e.id ? "…" : "Undo"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && rows.length === 0 ? (
          <div className="cq-card p-8 text-center">
            <div className="text-5xl mb-3">📜</div>
            <div className="font-semibold text-gray-700">No history yet</div>
            <div className="text-sm text-gray-500 mt-1">
              Activity will appear here once chores are completed
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
