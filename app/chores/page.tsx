"use client";

import React, { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";
import {
  createChoreTemplate,
  deleteChoreTemplate,
  listChoreTemplates,
  updateChoreTemplate,
} from "@/src/lib/chores";
import { listHouseholdMembers, type HouseholdMember } from "@/src/lib/members";
import type { AssigneeMode, ChoreTemplate, Frequency } from "@/src/types";

const freqOrder: Frequency[] = ["daily", "weekly", "monthly", "seasonal"];
const freqLabel: Record<Frequency, string> = {
  daily: "Daily Chores",
  weekly: "Weekly Chores",
  monthly: "Monthly Chores",
  seasonal: "Seasonal Chores",
};
const freqPill: Record<Frequency, string> = {
  daily: "bg-blue-50 text-blue-700",
  weekly: "bg-purple-50 text-purple-700",
  monthly: "bg-orange-50 text-orange-700",
  seasonal: "bg-emerald-50 text-emerald-700",
};

// emoji list (duplicates are ok now because key uses idx)
const icons = [
  "🪴",
  "🧹",
  "🧺",
  "🛒",
  "🗑️",
  "🚗",
  "🛁",
  "🪟",
  "🍽️",
  "🛏️",
  "🐶",
  "🧼",
  "🧽",
  "🧯",
  "🔧",
  "🎁",
  "🌿",
  "🧊",
  "📦",
  "🧻",
  "🪣",
  "🧤",
  "🪠",
  "🪥",
  "🧴",
  "🧺",
  "🧼",
  "🧹",
  "🪟",
  "🛒",
];

export default function ChoresPage() {
  return (
    <RequireAuth>
      <ChoresInner />
    </RequireAuth>
  );
}

function ChoresInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);

  const [items, setItems] = useState<ChoreTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // modal
  const [open, setOpen] = useState(false);

  // toast
  const [toast, setToast] = useState<string | null>(null);

  // form
  const [icon, setIcon] = useState<string>("🪴");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState<number>(30);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [assigneeMode, setAssigneeMode] = useState<AssigneeMode>("anyone");
  const [fixedUid, setFixedUid] = useState<string>("");

  useEffect(() => {
    async function load() {
      const p = await getUserProfile(uid);
      const hid = p?.householdId ?? null;
      setHouseholdId(hid);

      if (hid) {
        const mem = await listHouseholdMembers(hid);
        setMembers(mem);
        setFixedUid(mem.find((m) => m.uid === uid)?.uid ?? mem[0]?.uid ?? "");
      }
    }
    load();
  }, [uid]);

  async function refresh(hid: string) {
    setError(null);
    setLoading(true);
    try {
      const data = await listChoreTemplates(hid);
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load chores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!householdId) return;
    refresh(householdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const grouped = useMemo(() => {
    const map: Record<string, ChoreTemplate[]> = {
      daily: [],
      weekly: [],
      monthly: [],
      seasonal: [],
    };
    for (const c of items) map[c.frequency]?.push(c);
    return map as Record<Frequency, ChoreTemplate[]>;
  }, [items]);

  async function createAndSave() {
    if (!householdId) return;
    if (!title.trim()) return;

    setBusy("create");
    setError(null);

    try {
      const who =
        assigneeMode === "fixed"
          ? (members.find((m) => m.uid === fixedUid)?.name ?? "Fixed member")
          : assigneeMode === "rotating"
            ? "Rotating"
            : "Anyone";

      // Save to Firestore
      await createChoreTemplate(householdId, {
        // store icon in title (simple + no type conflicts)
        title: `${icon} ${title.trim()}`,
        points,
        frequency,
        assigneeMode,
        active: true,
        ...(assigneeMode === "fixed"
          ? { fixedAssigneeUid: fixedUid || uid }
          : {}),
        // schedule exists in DB even if empty
        schedule: {},
      } as any);

      await refresh(householdId);

      setToast(
        `Saved: "${icon} ${title.trim()}" (${points} pts • ${frequency} • ${who})`,
      );
      window.setTimeout(() => setToast(null), 2200);

      // reset + close
      setOpen(false);
      setTitle("");
      setPoints(30);
      setFrequency("weekly");
      setAssigneeMode("anyone");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create chore (check Firestore rules)");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!householdId) return;
    if (!confirm("Delete this chore?")) return;

    setBusy(id);
    setError(null);
    try {
      await deleteChoreTemplate(householdId, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete chore");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(c: ChoreTemplate) {
    if (!householdId) return;
    setBusy(c.id);
    setError(null);
    try {
      await updateChoreTemplate(householdId, c.id, {
        active: !c.active,
      } as any);
      setItems((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)),
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to update chore");
    } finally {
      setBusy(null);
    }
  }

  if (!householdId) {
    return <div className="text-sm text-gray-500">Loading household…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="cq-card p-5 flex items-center justify-between">
        <div>
          <div className="cq-title">Chore Templates</div>
          <div className="cq-subtitle">
            Manage your recurring household tasks
          </div>
          {error ? (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          ) : null}
        </div>

        <button
          className="cq-btn-primary"
          onClick={() => setOpen(true)}
          type="button">
          ➕ New Chore
        </button>
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading…</div> : null}

      {freqOrder.map((f) => (
        <div key={f} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span>
              {f === "daily"
                ? "✨"
                : f === "weekly"
                  ? "📆"
                  : f === "monthly"
                    ? "🗓️"
                    : "🍂"}
            </span>
            <span>{freqLabel[f]}</span>
            <span className="text-gray-400">({grouped[f]?.length ?? 0})</span>
          </div>

          {(grouped[f] ?? []).map((c) => (
            <div key={c.id} className="cq-card-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{c.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span
                      className={
                        "rounded-full px-2 py-1 " + freqPill[c.frequency]
                      }>
                      {c.frequency}
                    </span>

                    <span className="cq-pill">👥 {c.assigneeMode}</span>

                    {c.assigneeMode === "fixed" && c.fixedAssigneeUid ? (
                      <span className="cq-pill">
                        🎯{" "}
                        {members.find((m) => m.uid === c.fixedAssigneeUid)
                          ?.name ?? "Fixed"}
                      </span>
                    ) : null}

                    <span className="cq-pill">
                      ⭐ {difficultyStars(c.points)}
                    </span>
                    <span className="cq-pill">🪙 {c.points} pts</span>

                    {!c.active ? (
                      <span className="cq-pill bg-gray-100 text-gray-600">
                        inactive
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="cq-btn"
                    onClick={() => toggleActive(c)}
                    disabled={busy === c.id}
                    type="button">
                    {busy === c.id ? "…" : c.active ? "Disable" : "Enable"}
                  </button>

                  <button
                    className="cq-btn"
                    onClick={() => remove(c.id)}
                    disabled={busy === c.id}
                    type="button">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* TOAST */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2">
          <div
            className="rounded-2xl border bg-white px-4 py-3 text-sm shadow-lg"
            style={{ borderColor: "var(--cq-border)" }}>
            {toast}
          </div>
        </div>
      ) : null}

      {/* MODAL */}
      {open ? (
        <div className="fixed inset-0 z-[60] bg-black/40">
          <div className="h-full w-full p-4 sm:p-6 grid place-items-center">
            <div className="w-full max-w-2xl rounded-2xl border bg-white shadow-lg overflow-hidden">
              {/* header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="text-lg font-semibold">Create New Chore</div>
                <button
                  className="cq-btn"
                  onClick={() => setOpen(false)}
                  type="button">
                  ✕
                </button>
              </div>

              {/* body */}
              <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
                {/* icon picker */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </div>
                  <div className="rounded-2xl border bg-white p-3">
                    <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
                      {icons.map((ic, idx) => (
                        <button
                          key={`${ic}-${idx}`}
                          className={
                            "h-10 w-10 rounded-xl border grid place-items-center " +
                            (icon === ic
                              ? "bg-purple-50 border-purple-200"
                              : "bg-white")
                          }
                          onClick={() => setIcon(ic)}
                          type="button">
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* name */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Chore Name
                  </div>
                  <input
                    className="cq-input"
                    placeholder="e.g., Vacuum Living Room"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* difficulty */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Difficulty (affects points)
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[10, 20, 30, 40, 50].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPoints(p)}
                        className={
                          "rounded-xl border p-3 text-center text-sm " +
                          (points === p ? "text-white" : "bg-white")
                        }
                        style={
                          points === p
                            ? {
                                background:
                                  "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
                                borderColor: "transparent",
                              }
                            : { borderColor: "var(--cq-border)" }
                        }>
                        <div>{difficultyStars(p)}</div>
                        <div className="text-xs opacity-80">{p} pts</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* frequency */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Frequency
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      ["daily", "weekly", "monthly", "seasonal"] as Frequency[]
                    ).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={
                          "rounded-xl border px-3 py-3 text-sm " +
                          (frequency === f ? "text-white" : "bg-white")
                        }
                        style={
                          frequency === f
                            ? {
                                background:
                                  "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
                                borderColor: "transparent",
                              }
                            : { borderColor: "var(--cq-border)" }
                        }>
                        {capitalize(f)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* assignee */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Who does this?
                  </div>

                  <div className="space-y-2">
                    <ModeCard
                      selected={assigneeMode === "anyone"}
                      title="Anyone"
                      desc="First person to claim/complete gets points"
                      onClick={() => setAssigneeMode("anyone")}
                    />
                    <ModeCard
                      selected={assigneeMode === "rotating"}
                      title="Rotating"
                      desc="Alternates between household members automatically"
                      onClick={() => setAssigneeMode("rotating")}
                    />
                    <ModeCard
                      selected={assigneeMode === "fixed"}
                      title="Fixed Person"
                      desc="Always assigned to the same person"
                      onClick={() => setAssigneeMode("fixed")}
                    />
                  </div>

                  {assigneeMode === "fixed" ? (
                    <div className="mt-3 rounded-2xl border bg-white p-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        Select member
                      </div>
                      <select
                        className="cq-input"
                        value={fixedUid}
                        onChange={(e) => setFixedUid(e.target.value)}>
                        {members.map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* footer */}
              <div className="px-6 py-4 border-t flex items-center justify-between">
                <button
                  className="cq-btn"
                  onClick={() => setOpen(false)}
                  type="button">
                  Cancel
                </button>

                <button
                  className="cq-btn-primary"
                  onClick={createAndSave}
                  disabled={busy === "create" || !title.trim()}
                  type="button">
                  {busy === "create" ? "Saving..." : "Create Chore"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModeCard({
  selected,
  title,
  desc,
  onClick,
}: {
  selected: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full text-left rounded-2xl border p-4 transition " +
        (selected ? "border-purple-200 bg-purple-50" : "bg-white")
      }
      style={!selected ? { borderColor: "var(--cq-border)" } : {}}>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{desc}</div>
    </button>
  );
}

function difficultyStars(points: number) {
  if (points <= 10) return "⭐";
  if (points <= 20) return "⭐⭐";
  if (points <= 30) return "⭐⭐⭐";
  if (points <= 40) return "⭐⭐⭐⭐";
  return "⭐⭐⭐⭐⭐";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
