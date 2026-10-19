// app/setup/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Copy, Link2, Share2, Sparkles } from "lucide-react";

import RequireAuth from "@/src/components/RequireAuth";
import { useHousehold } from "@/src/components/HouseholdProvider";
import { useFeedback } from "@/src/components/ui/Feedback";
import { Button, IconButton } from "@/src/components/ui/Button";
import { Avatar, Card, Segmented } from "@/src/components/ui/Display";
import { Mascot } from "@/src/components/ui/Mascot";
import { updateUserProfile } from "@/src/lib/profile";
import { createHousehold, joinHouseholdByCode } from "@/src/lib/households";
import { createChoreTemplate } from "@/src/lib/chores";
import { AVATAR_EMOJIS, FREQUENCY_LABEL, STARTER_CHORES, choreTitle } from "@/src/lib/choreCatalog";
import { friendlyError } from "@/src/lib/errors";

type Step = "name" | "household" | "invite" | "chores" | "done";

const STEP_ORDER: Step[] = ["name", "household", "invite", "chores", "done"];

export default function SetupPage() {
  return (
    <RequireAuth>
      <SetupInner />
    </RequireAuth>
  );
}

function SetupInner() {
  const router = useRouter();
  const { profile } = useHousehold();

  // Decided once on arrival; afterwards each step moves the wizard forward
  const [step, setStep] = useState<Step | "complete">(() => {
    if (!profile?.name?.trim()) return "name";
    if (!profile.householdId) return "household";
    return "complete";
  });

  // Setup already finished (e.g. an old bookmark): go to the app
  useEffect(() => {
    if (step === "complete") router.replace("/today");
  }, [step, router]);

  if (step === "complete") return null;

  const position = STEP_ORDER.indexOf(step);

  return (
    <div className="mx-auto max-w-md py-2">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-1.5" aria-label={`Step ${position + 1} of ${STEP_ORDER.length}`}>
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            className={clsx("h-1.5 flex-1 rounded-full transition-colors", i <= position ? "bg-brand" : "bg-gray-200")}
          />
        ))}
      </div>

      <div key={step} className="animate-slide-up">
        {step === "name" ? (
          <NameStep onDone={(hasHousehold) => setStep(hasHousehold ? "done" : "household")} />
        ) : step === "household" ? (
          <HouseholdStep onCreated={() => setStep("invite")} onJoined={() => setStep("done")} />
        ) : step === "invite" ? (
          <InviteStep onNext={() => setStep("chores")} />
        ) : step === "chores" ? (
          <ChoresStep onNext={() => setStep("done")} />
        ) : (
          <DoneStep />
        )}
      </div>
    </div>
  );
}

function StepHeader({ mood = "happy", title, subtitle }: { mood?: "happy" | "celebrate" | "thinking"; title: string; subtitle: string }) {
  return (
    <div className="mb-6 text-center">
      <Mascot mood={mood} size={88} className="mx-auto text-ink" bob={mood === "celebrate"} />
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

// ---------- Step 1: name + avatar ----------

function NameStep({ onDone }: { onDone: (hasHousehold: boolean) => void }) {
  const { uid, profile } = useHousehold();
  const [name, setName] = useState(profile?.name ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!uid || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateUserProfile(uid, { name: name.trim(), avatar });
      onDone(!!profile?.householdId);
    } catch (e) {
      setError(friendlyError(e, "Couldn't save your name. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StepHeader title="Hi there! What’s your name?" subtitle="It shows on chores and the leaderboard." />
      <Card className="space-y-5 p-5">
        <div className="flex items-center gap-3">
          <Avatar uid={uid ?? "me"} name={name || "?"} emoji={avatar} size={56} />
          <input
            className="cq-input text-base"
            value={name}
            maxLength={30}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="Your name"
            aria-label="Your name"
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink">Pick an avatar (optional)</legend>
          <div className="grid grid-cols-8 gap-1.5">
            {AVATAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setAvatar(avatar === e ? null : e)}
                aria-label={`Use ${e} as avatar`}
                aria-pressed={avatar === e}
                className={clsx(
                  "grid aspect-square place-items-center rounded-xl text-xl transition",
                  avatar === e ? "bg-brand-soft ring-2 ring-brand" : "hover:bg-surface-2",
                )}>
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button variant="primary" size="lg" block onClick={save} loading={busy} disabled={!name.trim()}>
          Continue
        </Button>
      </Card>
    </>
  );
}

// ---------- Step 2: create or join ----------

function HouseholdStep({ onCreated, onJoined }: { onCreated: () => void; onJoined: () => void }) {
  const { uid, profile } = useHousehold();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [householdName, setHouseholdName] = useState(
    profile?.name ? `${profile.name.split(" ")[0]}’s home` : "Our home",
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!uid) return;
    setBusy(true);
    setError(null);
    try {
      await createHousehold({ uid, name: householdName.trim() || "Household" });
      onCreated();
    } catch (e) {
      setError(friendlyError(e, "Couldn't create the household. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!uid || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await joinHouseholdByCode({ uid, code });
      onJoined();
    } catch (e) {
      setError(
        (e as Error)?.message === "Household code not found."
          ? "We couldn't find a household with that code. Check it and try again."
          : friendlyError(e, "Couldn't join the household. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StepHeader
        mood="thinking"
        title="Set up your household"
        subtitle="Everyone in a household shares chores and competes on the leaderboard."
      />
      <Segmented<"create" | "join">
        label="Create or join"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: "create", label: "Start a new one" },
          { value: "join", label: "I have a code" },
        ]}
        className="mb-4"
      />
      <Card className="space-y-4 p-5">
        {mode === "create" ? (
          <>
            <label htmlFor="household-name" className="block text-sm font-bold text-ink">
              Household name
            </label>
            <input
              id="household-name"
              className="cq-input text-base"
              value={householdName}
              maxLength={40}
              onChange={(e) => setHouseholdName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
            />
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
            <Button variant="primary" size="lg" block onClick={create} loading={busy}>
              <Sparkles size={18} aria-hidden="true" /> Create household
            </Button>
          </>
        ) : (
          <>
            <label htmlFor="join-code" className="block text-sm font-bold text-ink">
              Invite code
            </label>
            <input
              id="join-code"
              className="cq-input text-center font-mono text-2xl font-extrabold uppercase tracking-[0.3em]"
              value={code}
              maxLength={10}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") join();
              }}
              placeholder="AB12CD"
            />
            <p className="text-xs text-muted">Ask a household member for the code. It&apos;s on their Household tab.</p>
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
            <Button variant="primary" size="lg" block onClick={join} loading={busy} disabled={!code.trim()}>
              <Link2 size={18} aria-hidden="true" /> Join household
            </Button>
          </>
        )}
      </Card>
    </>
  );
}

// ---------- Step 3: invite ----------

function InviteStep({ onNext }: { onNext: () => void }) {
  const { household } = useHousehold();
  const { toast } = useFeedback();
  const code = household?.code ?? "";

  const inviteText = `Join our household "${household?.name ?? ""}" on ChoreQuest! Sign up at ${
    typeof window !== "undefined" ? window.location.origin : ""
  } and enter the code ${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast("Code copied ✓");
    } catch {
      toast("Couldn't copy. Please write the code down.", { tone: "error" });
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on ChoreQuest", text: inviteText });
      } catch {
        // closed the share sheet
      }
    } else {
      await navigator.clipboard.writeText(inviteText).catch(() => {});
      toast("Invite message copied ✓");
    }
  }

  return (
    <>
      <StepHeader title="Who lives with you?" subtitle="Invite your partner, family or roommates with this code." />
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-2xl border-2 border-dashed border-purple-200 bg-brand-soft px-4 py-4 text-center font-mono text-3xl font-extrabold tracking-[0.3em] text-brand-strong">
            {code || "……"}
          </div>
          <IconButton aria-label="Copy invite code" onClick={copy} className="h-14 w-14 border border-line">
            <Copy size={20} />
          </IconButton>
        </div>
        <Button variant="primary" size="lg" block onClick={share} disabled={!code}>
          <Share2 size={18} aria-hidden="true" /> Share invite
        </Button>
        <Button variant="ghost" block onClick={onNext}>
          I&apos;ll do this later
        </Button>
      </Card>
    </>
  );
}

// ---------- Step 4: starter chores ----------

function ChoresStep({ onNext }: { onNext: () => void }) {
  const { household, templates } = useHousehold();
  const { toast } = useFeedback();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(STARTER_CHORES.map((_, i) => i)));
  const [busy, setBusy] = useState(false);

  // Joined a household that already has chores? Nothing to pick.
  useEffect(() => {
    if (templates.length > 0) onNext();
  }, [templates.length, onNext]);

  function toggle(i: number) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function add() {
    if (!household) return;
    setBusy(true);
    try {
      await Promise.all(
        [...selected].map((i) => {
          const s = STARTER_CHORES[i];
          return createChoreTemplate(household.id, {
            title: choreTitle(s.icon, s.title),
            points: s.points,
            frequency: s.frequency,
            assigneeMode: s.assigneeMode,
            active: true,
            schedule: {},
          });
        }),
      );
      onNext();
    } catch (e) {
      toast(friendlyError(e, "Couldn't add the chores. You can add them later on the Household tab."), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StepHeader title="Pick some chores" subtitle="Start with these and tweak them later. You can always add your own." />
      <Card className="divide-y divide-line overflow-hidden">
        {STARTER_CHORES.map((s, i) => {
          const on = selected.has(i);
          return (
            <button
              key={s.title}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(i)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2">
              <span className="text-2xl" aria-hidden="true">
                {s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">{s.title}</span>
                <span className="block text-xs text-muted">
                  {FREQUENCY_LABEL[s.frequency]} · {s.points} pts
                </span>
              </span>
              <span
                className={clsx(
                  "grid h-6 w-6 place-items-center rounded-lg border-2 transition",
                  on ? "border-brand bg-brand text-white" : "border-gray-300",
                )}
                aria-hidden="true">
                {on ? <Check size={14} strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </Card>
      <div className="mt-4 space-y-2">
        <Button variant="primary" size="lg" block onClick={add} loading={busy} disabled={selected.size === 0}>
          Add {selected.size} {selected.size === 1 ? "chore" : "chores"}
        </Button>
        <Button variant="ghost" block onClick={onNext}>
          Skip, I&apos;ll add my own
        </Button>
      </div>
    </>
  );
}

// ---------- Step 5: done ----------

function DoneStep() {
  const router = useRouter();
  const { celebrate } = useFeedback();

  useEffect(() => {
    celebrate({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
  }, [celebrate]);

  return (
    <>
      <StepHeader mood="celebrate" title="You’re all set! 🎉" subtitle="Complete chores to earn points. Good luck winning the week!" />
      <Button variant="primary" size="lg" block onClick={() => router.replace("/today")}>
        Let&apos;s go
      </Button>
    </>
  );
}
