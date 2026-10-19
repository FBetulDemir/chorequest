"use client";

import React, { useMemo, useState } from "react";
import { Copy, History, LogOut, Pencil, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";

import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import ChoreManager from "@/src/components/ChoreManager";
import { useFeedback } from "@/src/components/ui/Feedback";
import { Button, IconButton } from "@/src/components/ui/Button";
import { Avatar, Card, ListRow, SectionTitle } from "@/src/components/ui/Display";
import { ConfirmSheet, Sheet } from "@/src/components/ui/Sheet";
import { renameHousehold } from "@/src/lib/households";
import { getRangeMs } from "@/src/lib/ledgerHelpers";
import { scoresInRange } from "@/src/lib/scoring";
import { friendlyError } from "@/src/lib/errors";
import { copyText, shareText } from "@/src/lib/native";
import { inviteMessage } from "@/src/lib/invite";
import { isOnlyMember, leaveHousehold } from "@/src/lib/account";

export default function HouseholdPage() {
  return (
    <RequireAuth>
      <HouseholdInner />
    </RequireAuth>
  );
}

function HouseholdInner() {
  const { uid, household, householdId, members, ledger } = useReadyHousehold();
  const { toast } = useFeedback();
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const router = useRouter();
  const alone = isOnlyMember(household, uid);

  async function leave() {
    setLeaveBusy(true);
    try {
      await leaveHousehold(uid, householdId);
      toast(`You left ${household.name}`);
      router.replace("/setup");
    } catch (e) {
      toast(friendlyError(e, "Couldn't leave the household. Please try again."), { tone: "error" });
      setLeaveBusy(false);
      setLeaving(false);
    }
  }

  const weekly = useMemo(() => {
    const { startMs, endMs } = getRangeMs("week");
    return scoresInRange(ledger, startMs, endMs);
  }, [ledger]);

  async function copyCode() {
    const ok = await copyText(household.code);
    if (ok) toast("Invite code copied ✓");
    else toast("Couldn't copy. Please select the code and copy it manually.", { tone: "error" });
  }

  async function share() {
    const result = await shareText(inviteMessage(household));
    if (result === "copied") toast("Invite message copied. Paste it in a chat ✓");
    else if (result === "failed") toast("Couldn't share the invite.", { tone: "error" });
  }

  return (
    <div className="space-y-6">
      {/* Household header */}
      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-(image:--cq-gradient) opacity-15 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Your household</div>
            <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-ink">{household.name}</h1>
            <div className="mt-3 flex items-center">
              <div className="flex -space-x-2">
                {members.slice(0, 6).map((m) => (
                  <Avatar key={m.uid} uid={m.uid} name={m.name} emoji={m.avatar} size={34} ring />
                ))}
              </div>
              <span className="ml-3 text-sm font-semibold text-muted">
                {members.length} {members.length === 1 ? "member" : "members"}
              </span>
            </div>
          </div>
          <IconButton aria-label="Rename household" onClick={() => setRenaming(true)}>
            <Pencil size={18} />
          </IconButton>
        </div>
      </Card>

      {/* Invite */}
      <Card className="p-5">
        <SectionTitle>Invite someone</SectionTitle>
        <p className="mt-1 text-sm text-muted">They sign up, then enter this code on the setup screen.</p>
        <div className="mt-4 flex items-center gap-2">
          <div
            className="flex-1 rounded-2xl border-2 border-dashed border-purple-200 bg-brand-soft px-4 py-3 text-center font-mono text-2xl font-extrabold tracking-[0.3em] text-brand-strong"
            aria-label={`Invite code ${household.code.split("").join(" ")}`}>
            {household.code || "—"}
          </div>
          <IconButton aria-label="Copy invite code" onClick={copyCode} className="h-12 w-12 border border-line">
            <Copy size={18} />
          </IconButton>
        </div>
        <Button variant="primary" block className="mt-3" onClick={share}>
          <Share2 size={16} aria-hidden="true" /> Share invite
        </Button>
      </Card>

      {/* Members */}
      <section className="space-y-3" aria-labelledby="members-heading">
        <SectionTitle>
          <span id="members-heading">Members</span>
        </SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          {members.map((m) => {
            const s = weekly.get(m.uid);
            return (
              <div key={m.uid} className="flex items-center gap-3 px-4 py-3">
                <Avatar uid={m.uid} name={m.name} emoji={m.avatar} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-ink">
                    {m.name}
                    {m.uid === uid ? <span className="cq-pill ml-2 px-2 py-0.5">You</span> : null}
                  </div>
                  <div className="text-xs text-muted">
                    {s ? `${s.chores} chores · ${s.points} pts this week` : "No chores yet this week"}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      {/* Chores */}
      <div id="chores" className="scroll-mt-24">
        <ChoreManager />
      </div>

      <Card className="overflow-hidden">
        <ListRow
          href="/history"
          icon={<History size={18} />}
          title="Activity history"
          description="Everything your household has done, with undo"
        />
        <ListRow
          icon={<LogOut size={18} />}
          title="Leave household"
          description="Join or create a different one"
          onClick={() => setLeaving(true)}
          danger
        />
      </Card>

      <ConfirmSheet
        open={leaving}
        title={`Leave ${household.name}?`}
        message={
          alone
            ? "You're the only member. If you leave, nobody will be able to open this household or its chores again."
            : "You'll stop seeing its chores and leaderboard. Your past points stay in its history, and you can rejoin with the invite code."
        }
        confirmLabel="Leave"
        danger
        busy={leaveBusy}
        onConfirm={leave}
        onCancel={() => setLeaving(false)}
      />

      {renaming ? (
        <RenameSheet
          householdId={householdId}
          currentName={household.name}
          onClose={() => setRenaming(false)}
        />
      ) : null}
    </div>
  );
}

function RenameSheet({
  householdId,
  currentName,
  onClose,
}: {
  householdId: string;
  currentName: string;
  onClose: () => void;
}) {
  const { toast } = useFeedback();
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await renameHousehold(householdId, name);
      toast("Household renamed ✓");
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Couldn't rename the household."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Rename household"
      size="sm"
      footer={
        <Button variant="primary" block onClick={save} loading={busy} disabled={!name.trim()}>
          Save
        </Button>
      }>
      <label htmlFor="household-name" className="mb-2 block text-sm font-bold text-ink">
        Household name
      </label>
      <input
        id="household-name"
        className="cq-input"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) save();
        }}
      />
      {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : null}
    </Sheet>
  );
}
