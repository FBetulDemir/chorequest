"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";
import { addLedgerEntry, listLedgerEntries } from "@/src/lib/points";
import type { PointsLedgerEntry } from "@/src/types";

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

          return (
            <div key={e.id} className="cq-card-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {reason
                      .replace("Completed: ", "")
                      .replace("Skipped: ", "")
                      .replace("Undo: ", "")}
                    <span className="ml-2 text-xs text-gray-400">
                      {isCompleted
                        ? "(done)"
                        : isSkipped
                          ? "(skipped)"
                          : isUndo
                            ? "(undo)"
                            : ""}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    {who} • {when}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="cq-pill">
                    {Number(e.delta ?? 0) > 0
                      ? `+${e.delta}`
                      : Number(e.delta ?? 0) < 0
                        ? `${e.delta}`
                        : "0"}
                  </div>

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
          <div className="cq-card-soft p-8 text-center text-sm text-gray-500">
            No history yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
