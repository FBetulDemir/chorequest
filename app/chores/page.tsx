"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { AssigneeMode, ChoreTemplate, Frequency } from "@/src/lib/types";

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

// Starter chore templates for new households
const starterChores = [
  // Daily
  {
    icon: "🍽️",
    title: "Do Dishes",
    points: 20,
    frequency: "daily" as Frequency,
    assigneeMode: "rotating" as AssigneeMode,
  },
  {
    icon: "🧹",
    title: "Sweep Kitchen Floor",
    points: 10,
    frequency: "daily" as Frequency,
    assigneeMode: "anyone" as AssigneeMode,
  },
  {
    icon: "🗑️",
    title: "Take Out Trash",
    points: 10,
    frequency: "daily" as Frequency,
    assigneeMode: "rotating" as AssigneeMode,
  },
  {
    icon: "🪴",
    title: "Water Plants",
    points: 10,
    frequency: "daily" as Frequency,
    assigneeMode: "anyone" as AssigneeMode,
  },
  // Weekly
  {
    icon: "🧺",
    title: "Do Laundry",
    points: 30,
    frequency: "weekly" as Frequency,
    assigneeMode: "anyone" as AssigneeMode,
  },
  {
    icon: "🧹",
    title: "Vacuum Living Room",
    points: 30,
    frequency: "weekly" as Frequency,
    assigneeMode: "rotating" as AssigneeMode,
  },
  {
    icon: "🛁",
    title: "Clean Bathroom",
    points: 40,
    frequency: "weekly" as Frequency,
    assigneeMode: "rotating" as AssigneeMode,
  },
  {
    icon: "🪟",
    title: "Wipe Windows",
    points: 30,
    frequency: "weekly" as Frequency,
    assigneeMode: "anyone" as AssigneeMode,
  },
  {
    icon: "🛏️",
    title: "Change Bed Sheets",
    points: 20,
    frequency: "weekly" as Frequency,
    assigneeMode: "anyone" as AssigneeMode,
  },
  // Monthly
  {
    icon: "🛒",
    title: "Grocery Shopping",
    points: 40,
    frequency: "monthly" as Frequency,
    assigneeMode: "rotating" as AssigneeMode,
  },
  {
    icon: "🚗",
    title: "Wash Car",
    points: 30,
    frequency: "monthly" as Frequency,
    assigneeMode: "anyone" as AssigneeMode,
  },
  {
    icon: "🧊",
    title: "Defrost Freezer",
    points: 40,
    frequency: "monthly" as Frequency,
    assigneeMode: "anyone" as AssigneeMode,
  },
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
  const [editingChore, setEditingChore] = useState<ChoreTemplate | null>(null);

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
        // Set default to current user if they're in members, otherwise first member
        const defaultMember = mem.find((m) => m.uid === uid) ?? mem[0];
        setFixedUid(defaultMember?.uid ?? "");
      }
    }
    load();
  }, [uid]);

  async function refresh(hid: string) {
    setError(null);
    setLoading(true);
    try {
      // Load both chores and members to ensure member names are available
      const [data, mem] = await Promise.all([
        listChoreTemplates(hid),
        listHouseholdMembers(hid),
      ]);
      setItems(data);
      setMembers(mem);
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

  async function openEditMode(chore: ChoreTemplate) {
    // Extract icon and title from chore.title (format: "🪴 Water Plants")
    const titleParts = chore.title.split(" ");
    const extractedIcon = titleParts[0];
    const extractedTitle = titleParts.slice(1).join(" ");

    setEditingChore(chore);
    setIcon(extractedIcon);
    setTitle(extractedTitle);
    setPoints(chore.points);
    setFrequency(chore.frequency);
    setAssigneeMode(chore.assigneeMode);
    setFixedUid(chore.fixedAssigneeUid ?? fixedUid);
    setOpen(true);
  }

  function openCreateMode() {
    setEditingChore(null);
    setIcon("🪴");
    setTitle("");
    setPoints(30);
    setFrequency("weekly");
    setAssigneeMode("anyone");
    setOpen(true);
  }

  async function saveChore() {
    if (!householdId) return;
    if (!title.trim()) return;

    setBusy(editingChore?.id ?? "create");
    setError(null);

    try {
      const who =
        assigneeMode === "fixed"
          ? (members.find((m) => m.uid === fixedUid)?.name ?? "Fixed member")
          : assigneeMode === "rotating"
            ? "Rotating"
            : "Anyone";

      // Validate fixedUid exists in members if mode is fixed
      let validFixedUid = fixedUid || uid;
      if (assigneeMode === "fixed") {
        const memberExists = members.some((m) => m.uid === validFixedUid);
        if (!memberExists) {
          // Fallback to current user if the selected member doesn't exist
          validFixedUid = uid;
        }
      }

      const choreData = {
        title: `${icon} ${title.trim()}`,
        points,
        frequency,
        assigneeMode,
        active: true,
        ...(assigneeMode === "fixed" ? { fixedAssigneeUid: validFixedUid } : {}),
        schedule: {},
      } as any;

      if (editingChore) {
        // Update existing chore
        await updateChoreTemplate(householdId, editingChore.id, choreData);
        setToast(`Updated: "${icon} ${title.trim()}"`);
      } else {
        // Create new chore
        await createChoreTemplate(householdId, choreData);
        setToast(
          `Created: "${icon} ${title.trim()}" (${points} pts • ${frequency} • ${who})`,
        );
      }

      await refresh(householdId);
      window.setTimeout(() => setToast(null), 2200);

      // reset + close
      setOpen(false);
      setEditingChore(null);
      setTitle("");
      setPoints(30);
      setFrequency("weekly");
      setAssigneeMode("anyone");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save chore (check Firestore rules)");
    } finally {
      setBusy(null);
    }
  }

  // Check if starter chores have been loaded by looking for matching titles
  const hasStarterChores = useMemo(() => {
    if (items.length === 0) return false;

    // Check if at least 3 starter chore titles exist in current chores
    const starterTitles = starterChores.map(
      (s) => `${s.icon} ${s.title}`,
    );
    const matchCount = items.filter((item) =>
      starterTitles.includes(item.title),
    ).length;

    // If we have at least 3 matching starter chores, consider them loaded
    return matchCount >= 3;
  }, [items]);

  async function loadStarterChores() {
    if (!householdId) return;
    if (hasStarterChores) {
      setToast("Starter chores already loaded!");
      window.setTimeout(() => setToast(null), 2200);
      return;
    }

    setBusy("starter");
    setError(null);

    try {
      for (const starter of starterChores) {
        await createChoreTemplate(householdId, {
          title: `${starter.icon} ${starter.title}`,
          points: starter.points,
          frequency: starter.frequency,
          assigneeMode: starter.assigneeMode,
          active: true,
          schedule: {},
        } as any);
      }

      await refresh(householdId);
      setToast(`Added ${starterChores.length} starter chores! 🎉`);
      window.setTimeout(() => setToast(null), 2200);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load starter chores");
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
      <div className="cq-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="cq-title">Chore Templates</div>
            <div className="cq-subtitle">
              Manage your recurring household tasks
            </div>
            {error ? (
              <div className="mt-2 text-sm text-red-600">{error}</div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              className="cq-btn text-xs whitespace-nowrap"
              onClick={loadStarterChores}
              disabled={busy === "starter" || hasStarterChores}
              type="button"
              title={
                hasStarterChores
                  ? "Starter chores already loaded"
                  : "Add 12 common household chores"
              }>
              {busy === "starter"
                ? "Loading..."
                : hasStarterChores
                  ? "✓ Starter Chores Loaded"
                  : "✨ Load Starter Chores"}
            </button>
            <button
              className="cq-btn-primary whitespace-nowrap"
              onClick={openCreateMode}
              type="button">
              ➕ New Chore
            </button>
          </div>
        </div>
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
            <div
              key={c.id}
              className={
                "cq-card p-4 hover:shadow-md transition-shadow " +
                (!c.active ? "opacity-60" : "")
              }>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base">{c.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 font-medium border " +
                        freqPill[c.frequency]
                      }>
                      {c.frequency}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                      <span>👥</span>
                      <span className="capitalize">{c.assigneeMode}</span>
                    </span>

                    {c.assigneeMode === "fixed" && c.fixedAssigneeUid ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 font-medium">
                        <span>🎯</span>
                        <span>
                          {(() => {
                            const member = members.find(
                              (m) => m.uid === c.fixedAssigneeUid,
                            );
                            if (member) return member.name;
                            // If member not found, might be deleted or not loaded yet
                            return members.length > 0
                              ? "Unknown Member"
                              : "Loading...";
                          })()}
                        </span>
                      </span>
                    ) : null}

                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                      <span>{difficultyStars(c.points)}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 font-semibold">
                      <span>🪙</span>
                      <span>{c.points} pts</span>
                    </span>

                    {!c.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-gray-100 text-gray-600 border border-gray-200 font-medium">
                        inactive
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="cq-btn text-xs"
                    onClick={() => openEditMode(c)}
                    disabled={busy === c.id}
                    type="button">
                    ✏️ Edit
                  </button>

                  <button
                    className="cq-btn text-xs"
                    onClick={() => toggleActive(c)}
                    disabled={busy === c.id}
                    type="button">
                    {busy === c.id ? "…" : c.active ? "Disable" : "Enable"}
                  </button>

                  <button
                    className="cq-btn text-xs text-red-600 hover:bg-red-50"
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
        <div className="fixed bottom-6 left-1/2 z-80 -translate-x-1/2">
          <div
            className="rounded-2xl border bg-white px-4 py-3 text-sm shadow-lg"
            style={{ borderColor: "var(--cq-border)" }}>
            {toast}
          </div>
        </div>
      ) : null}

      {/* MODAL */}
      {open ? (
        <div className="fixed inset-0 z-60 bg-black/40">
          <div className="h-full w-full p-4 sm:p-6 grid place-items-center">
            <div className="w-full max-w-2xl rounded-2xl border bg-white shadow-lg overflow-hidden">
              {/* header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="text-lg font-semibold">
                  {editingChore ? "Edit Chore" : "Create New Chore"}
                </div>
                <button
                  className="cq-btn"
                  onClick={() => {
                    setOpen(false);
                    setEditingChore(null);
                  }}
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
                  onClick={() => {
                    setOpen(false);
                    setEditingChore(null);
                  }}
                  type="button">
                  Cancel
                </button>

                <button
                  className="cq-btn-primary"
                  onClick={saveChore}
                  disabled={
                    busy === (editingChore?.id ?? "create") || !title.trim()
                  }
                  type="button">
                  {busy === (editingChore?.id ?? "create")
                    ? "Saving..."
                    : editingChore
                      ? "Update Chore"
                      : "Create Chore"}
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
