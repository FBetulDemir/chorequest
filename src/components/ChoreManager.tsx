"use client";

import React, { useMemo, useState } from "react";
import clsx from "clsx";
import { Pause, Play, Plus, Repeat, Sparkles, Trash2, UserCheck, Users } from "lucide-react";

import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { useFeedback } from "@/src/components/ui/Feedback";
import { Button } from "@/src/components/ui/Button";
import { Avatar, EmptyState, ListSkeleton, PointsPill, SectionTitle } from "@/src/components/ui/Display";
import { ConfirmSheet, Sheet } from "@/src/components/ui/Sheet";
import {
  createChoreTemplate,
  deleteChoreTemplate,
  updateChoreTemplate,
} from "@/src/lib/chores";
import {
  EFFORT_LEVELS,
  FREQUENCIES,
  FREQUENCY_HINT,
  FREQUENCY_LABEL,
  ICON_CATEGORIES,
  STARTER_CHORES,
  choreTitle,
  choreParts,
} from "@/src/lib/choreCatalog";
import { friendlyError } from "@/src/lib/errors";
import { PlusPrompt, usePlan } from "@/src/components/Plus";
import { FREE_LIMITS, choreLimitReached } from "@/src/lib/plan";
import type { HouseholdMember } from "@/src/lib/members";
import { WEEKDAY_NAMES, describeSchedule, effectiveMonthDay, effectiveWeekDay, ordinal, startOfLocalDayMs } from "@/src/lib/schedule";
import type { AssigneeMode, ChoreSchedule, ChoreTemplate, ChoreTemplateInput, Frequency } from "@/src/lib/types";

// Week starts on Monday (as in Sweden)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const FREQUENCY_EMOJI: Record<Frequency, string> = {
  daily: "☀️",
  weekly: "📆",
  monthly: "🗓️",
  seasonal: "🍂",
};

function whoLabel(chore: ChoreTemplate, members: HouseholdMember[]) {
  if (chore.assigneeMode === "rotating") return "🔁 Takes turns";
  if (chore.assigneeMode === "fixed") {
    const name = members.find((m) => m.uid === chore.fixedAssigneeUid)?.name;
    return `🎯 ${name ?? "One person"}`;
  }
  return "👥 Anyone";
}

export default function ChoreManager() {
  const { uid, householdId, members, templates, dataLoading } = useReadyHousehold();
  const { toast } = useFeedback();

  // `null` chore = creating a new one
  const [editing, setEditing] = useState<{ chore: ChoreTemplate | null } | null>(null);
  const [addingStarters, setAddingStarters] = useState(false);
  const [limitPrompt, setLimitPrompt] = useState(false);
  const plan = usePlan();

  function startNewChore() {
    if (choreLimitReached(plan, templates.length)) setLimitPrompt(true);
    else setEditing({ chore: null });
  }

  const grouped = useMemo(() => {
    const map: Record<Frequency, ChoreTemplate[]> = { daily: [], weekly: [], monthly: [], seasonal: [] };
    for (const c of templates) map[c.frequency]?.push(c);
    for (const f of FREQUENCIES) {
      map[f].sort((a, b) => choreParts(a).name.localeCompare(choreParts(b).name));
    }
    return map;
  }, [templates]);

  // Starter chores count as loaded when at least 3 of them exist
  const hasStarterChores = useMemo(() => {
    const starterNames = new Set(STARTER_CHORES.map((s) => s.title));
    return templates.filter((t) => starterNames.has(choreParts(t).name)).length >= 3;
  }, [templates]);

  async function addStarterChores() {
    if (choreLimitReached(plan, templates.length, STARTER_CHORES.length)) {
      setLimitPrompt(true);
      return;
    }
    setAddingStarters(true);
    try {
      await Promise.all(
        STARTER_CHORES.map((s) =>
          createChoreTemplate(householdId, {
            title: s.title,
            icon: s.icon,
            points: s.points,
            frequency: s.frequency,
            assigneeMode: s.assigneeMode,
            active: true,
            schedule: {},
          }),
        ),
      );
      toast(`Added ${STARTER_CHORES.length} starter chores 🎉`);
    } catch (e) {
      toast(friendlyError(e, "Couldn't add the starter chores."), { tone: "error" });
    } finally {
      setAddingStarters(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="chores-heading">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            {!hasStarterChores ? (
              <Button size="sm" onClick={addStarterChores} loading={addingStarters}>
                <Sparkles size={14} aria-hidden="true" /> Starter pack
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={startNewChore}>
              <Plus size={16} aria-hidden="true" /> New chore
            </Button>
          </div>
        }>
        <span id="chores-heading">Chores</span>{" "}
        <span className="text-sm font-semibold text-muted">({templates.length})</span>
      </SectionTitle>

      {dataLoading ? <ListSkeleton rows={3} /> : null}

      {!dataLoading && templates.length === 0 ? (
        <EmptyState
          mood="thinking"
          title="No chores yet"
          description="Add your own, or start with our starter pack of 12 common household chores."
          action={
            <Button variant="primary" onClick={addStarterChores} loading={addingStarters}>
              <Sparkles size={16} aria-hidden="true" /> Add starter pack
            </Button>
          }
        />
      ) : null}

      {FREQUENCIES.filter((f) => grouped[f].length > 0).map((f) => (
        <div key={f} className="cq-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-muted">
            <span aria-hidden="true">{FREQUENCY_EMOJI[f]}</span>
            {FREQUENCY_LABEL[f]}
            <span className="font-semibold normal-case tracking-normal text-faint">· {grouped[f].length}</span>
          </div>
          <ul className="divide-y divide-line">
            {grouped[f].map((c) => {
              const { icon, name } = choreParts(c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setEditing({ chore: c })}
                    className={clsx(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2",
                      !c.active && "opacity-55",
                    )}
                    aria-label={`Edit ${name}`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden="true">
                      {icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-ink">{name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>{describeSchedule(c)}</span>
                        <span aria-hidden="true" className="text-faint">·</span>
                        {whoLabel(c, members)}
                        {!c.active ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-600">Paused</span>
                        ) : null}
                      </span>
                    </span>
                    <PointsPill points={c.points} />
                    <span className="text-faint" aria-hidden="true">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <PlusPrompt
        open={limitPrompt}
        onClose={() => setLimitPrompt(false)}
        title="You've hit the free limit"
        message={`Free households can have up to ${FREE_LIMITS.chores} chores. Upgrade to ChoreQuest Plus for unlimited chores, more members and the rewards shop. Or pause or delete a chore you don't need.`}
      />

      {editing ? (
        <ChoreEditor
          key={editing.chore?.id ?? "new"}
          chore={editing.chore}
          uid={uid}
          householdId={householdId}
          members={members}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function ChoreEditor({
  chore,
  uid,
  householdId,
  members,
  onClose,
}: {
  chore: ChoreTemplate | null;
  uid: string;
  householdId: string;
  members: HouseholdMember[];
  onClose: () => void;
}) {
  const { toast } = useFeedback();
  const initial = chore ? choreParts(chore) : { icon: "🪴", name: "" };

  const [icon, setIcon] = useState(initial.icon);
  const [name, setName] = useState(initial.name);
  const [points, setPoints] = useState(chore?.points ?? 30);
  const [frequency, setFrequency] = useState<Frequency>(chore?.frequency ?? "weekly");
  // New chores default to today's weekday / date; existing ones show the day they fall on now
  const [weekDay, setWeekDay] = useState(() => (chore ? effectiveWeekDay(chore) : new Date().getDay()));
  const [monthDay, setMonthDay] = useState(() => (chore ? effectiveMonthDay(chore) : Math.min(28, new Date().getDate())));
  const [assigneeMode, setAssigneeMode] = useState<AssigneeMode>(chore?.assigneeMode ?? "anyone");
  const [fixedUid, setFixedUid] = useState(
    chore?.fixedAssigneeUid && members.some((m) => m.uid === chore.fixedAssigneeUid) ? chore.fixedAssigneeUid : uid,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<"save" | "pause" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    setBusy("save");
    setError(null);
    try {
      let schedule: ChoreSchedule = chore?.schedule ?? {};
      if (frequency === "weekly" || frequency === "monthly") {
        const next: ChoreSchedule = frequency === "weekly" ? { weekDay } : { monthDay };
        const unchanged =
          chore &&
          chore.frequency === frequency &&
          (frequency === "weekly" ? effectiveWeekDay(chore) === weekDay : effectiveMonthDay(chore) === monthDay);
        // Changing the day starts the new pattern today, so earlier dates aren't "missed"
        schedule = unchanged ? { ...chore.schedule, ...next } : chore ? { ...next, since: startOfLocalDayMs(Date.now()) } : next;
      }
      const data: ChoreTemplateInput = {
        title: name.trim(),
        icon,
        points,
        frequency,
        assigneeMode,
        active: chore?.active ?? true,
        ...(assigneeMode === "fixed" ? { fixedAssigneeUid: fixedUid } : {}),
        schedule,
      };
      if (chore) {
        await updateChoreTemplate(householdId, chore.id, data);
        toast("Chore saved");
      } else {
        await createChoreTemplate(householdId, data);
        toast(`${icon} ${name.trim()} added`);
      }
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Couldn't save the chore. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  async function togglePaused() {
    if (!chore) return;
    setBusy("pause");
    try {
      await updateChoreTemplate(householdId, chore.id, { active: !chore.active });
      toast(chore.active ? "Chore paused. It won't show up until you resume it." : "Chore resumed");
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Couldn't update the chore."));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!chore) return;
    setBusy("delete");
    try {
      await deleteChoreTemplate(householdId, chore.id);
      toast("Chore deleted");
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Couldn't delete the chore."));
      setConfirmDelete(false);
    } finally {
      setBusy(null);
    }
  }

  const modes: { value: AssigneeMode; title: string; desc: string; Icon: typeof Users }[] = [
    { value: "anyone", title: "Anyone", desc: "Whoever does it first gets the points", Icon: Users },
    { value: "rotating", title: "Take turns", desc: "Rotates between household members", Icon: Repeat },
    { value: "fixed", title: "One person", desc: "Always the same person", Icon: UserCheck },
  ];

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={chore ? "Edit chore" : "New chore"}
        size="lg"
        footer={
          <div className="flex items-center gap-2">
            {chore ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} aria-label="Delete chore">
                  <Trash2 size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={togglePaused} loading={busy === "pause"}>
                  {chore.active ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  {chore.active ? "Pause" : "Resume"}
                </Button>
              </>
            ) : null}
            <div className="flex-1" />
            <Button variant="primary" onClick={save} loading={busy === "save"} disabled={!name.trim()}>
              {chore ? "Save" : "Add chore"}
            </Button>
          </div>
        }>
        <div className="space-y-6">
          {/* Icon + name */}
          <div>
            <label htmlFor="chore-name" className="mb-2 block text-sm font-bold text-ink">
              What needs doing?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className={clsx(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl transition",
                  pickerOpen ? "border-brand bg-brand-soft" : "border-line bg-surface-2 hover:border-brand",
                )}
                aria-label={`Change icon (current: ${icon})`}
                aria-expanded={pickerOpen}>
                {icon}
              </button>
              <input
                id="chore-name"
                className="cq-input"
                placeholder="e.g. Vacuum living room"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
              />
            </div>

            {pickerOpen ? (
              <div className="mt-3 max-h-56 space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface-2 p-3">
                {Object.entries(ICON_CATEGORIES).map(([category, emojis]) => (
                  <div key={category}>
                    <div className="mb-1.5 text-xs font-bold text-muted">{category}</div>
                    <div className="flex flex-wrap gap-1">
                      {emojis.map((ic) => (
                        <button
                          key={`${category}-${ic}`}
                          type="button"
                          onClick={() => {
                            setIcon(ic);
                            setPickerOpen(false);
                          }}
                          className={clsx(
                            "grid h-10 w-10 place-items-center rounded-xl text-xl transition",
                            icon === ic ? "bg-brand-soft ring-2 ring-brand" : "hover:bg-surface",
                          )}
                          aria-label={`Use ${ic}`}>
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Effort */}
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">How much effort?</legend>
            <div className="grid grid-cols-3 gap-2">
              {EFFORT_LEVELS.map((lvl) => (
                <button
                  key={lvl.points}
                  type="button"
                  onClick={() => setPoints(lvl.points)}
                  aria-pressed={points === lvl.points}
                  className={clsx(
                    "rounded-2xl border p-2.5 text-left transition",
                    points === lvl.points ? "border-transparent bg-(image:--cq-gradient) text-white shadow-card" : "border-line bg-surface hover:border-brand",
                  )}>
                  <div className="text-sm font-extrabold">{lvl.label}</div>
                  <div className={clsx("text-xs", points === lvl.points ? "text-white/85" : "text-muted")}>
                    {lvl.points} pts · {lvl.hint}
                  </div>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Frequency */}
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">How often?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  aria-pressed={frequency === f}
                  className={clsx(
                    "rounded-2xl border p-2.5 text-left transition",
                    frequency === f ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand",
                  )}>
                  <div className="text-sm font-extrabold text-ink">
                    {FREQUENCY_EMOJI[f]} {FREQUENCY_LABEL[f]}
                  </div>
                  <div className="text-xs text-muted">{FREQUENCY_HINT[f]}</div>
                </button>
              ))}
            </div>
            {frequency === "weekly" ? (
              <div className="mt-3">
                <div className="mb-2 text-xs font-bold text-muted">On which day?</div>
                <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Day of the week">
                  {WEEK_ORDER.map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={weekDay === d}
                      aria-label={WEEKDAY_NAMES[d]}
                      onClick={() => setWeekDay(d)}
                      className={clsx(
                        "h-11 rounded-xl text-sm font-extrabold transition",
                        weekDay === d ? "bg-brand text-white" : "bg-surface-2 text-ink hover:bg-brand-soft",
                      )}>
                      {WEEKDAY_NAMES[d].slice(0, 2)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Every {WEEKDAY_NAMES[weekDay]}</p>
              </div>
            ) : frequency === "monthly" ? (
              <label className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-muted">On which day of the month?</span>
                <select
                  className="cq-input w-auto"
                  value={monthDay}
                  onChange={(e) => setMonthDay(Number(e.target.value))}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {ordinal(d)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-2 text-xs text-muted">
                {frequency === "daily" ? "Every day." : "Every 3 months, starting from when the chore is created."}
              </p>
            )}
          </fieldset>

          {/* Assignee */}
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">Who does it?</legend>
            <div className="space-y-2">
              {modes.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setAssigneeMode(m.value)}
                  aria-pressed={assigneeMode === m.value}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                    assigneeMode === m.value ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand",
                  )}>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-brand-strong" aria-hidden="true">
                    <m.Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold text-ink">{m.title}</span>
                    <span className="block text-xs text-muted">{m.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            {assigneeMode === "fixed" ? (
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Choose a person">
                {members.map((m) => (
                  <button
                    key={m.uid}
                    type="button"
                    role="radio"
                    aria-checked={fixedUid === m.uid}
                    onClick={() => setFixedUid(m.uid)}
                    className={clsx(
                      "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-bold transition",
                      fixedUid === m.uid ? "border-brand bg-brand-soft text-brand-strong" : "border-line text-ink hover:border-brand",
                    )}>
                    <Avatar uid={m.uid} name={m.name} emoji={m.avatar} size={28} />
                    {m.uid === uid ? `${m.name} (you)` : m.name}
                  </button>
                ))}
              </div>
            ) : null}
          </fieldset>

          {error ? (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title="Delete this chore?"
        message={
          <>
            <strong className="text-ink">{choreTitle(icon, name)}</strong> will be removed for everyone. Points already
            earned stay on the leaderboard. Tip: you can <em>pause</em> it instead.
          </>
        }
        confirmLabel="Delete"
        danger
        busy={busy === "delete"}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
