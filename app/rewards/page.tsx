"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Gift, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";

import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { useFeedback } from "@/src/components/ui/Feedback";
import { Button, IconButton } from "@/src/components/ui/Button";
import { Avatar, Card, EmptyState, ListSkeleton, SectionTitle } from "@/src/components/ui/Display";
import { ConfirmSheet, Sheet } from "@/src/components/ui/Sheet";
import {
  COST_PRESETS,
  REWARD_ICONS,
  STARTER_REWARDS,
  cancelRedemption,
  createReward,
  deleteReward,
  fulfillRedemption,
  redeemReward,
  subscribeRedemptions,
  subscribeRewards,
  updateReward,
} from "@/src/lib/rewards";
import { walletFor } from "@/src/lib/wallet";
import { usePlan } from "@/src/components/Plus";
import { isPlus } from "@/src/lib/plan";
import Link from "next/link";
import { buttonClasses } from "@/src/components/ui/Button";
import { Mascot } from "@/src/components/ui/Mascot";
import { timeAgo } from "@/src/lib/dates";
import { friendlyError } from "@/src/lib/errors";
import type { Redemption, Reward } from "@/src/lib/types";

export default function RewardsPage() {
  return (
    <RequireAuth>
      <RewardsGate />
    </RequireAuth>
  );
}

function RewardsGate() {
  const plan = usePlan();
  if (isPlus(plan)) return <RewardsInner />;
  return (
    <div className="mx-auto max-w-md space-y-5 text-center">
      <Mascot mood="celebrate" size={96} className="mx-auto text-ink" bob />
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Turn points into treats 🎁</h1>
      <p className="text-sm text-muted">
        With ChoreQuest Plus your household sets up rewards, like picking the movie or breakfast in bed, and everyone
        spends the coins they earn from chores.
      </p>
      <Link href="/plus" className={buttonClasses({ variant: "primary", size: "lg", block: true })}>
        Unlock with Plus
      </Link>
    </div>
  );
}

function useRewardsData(householdId: string) {
  const [rewards, setRewards] = useState<{ key: string; value: Reward[] } | null>(null);
  const [redemptions, setRedemptions] = useState<{ key: string; value: Redemption[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeRewards(
        householdId,
        (value) => setRewards({ key: householdId, value }),
        (e) => setError(friendlyError(e, "Couldn't load rewards.")),
      ),
    [householdId],
  );
  useEffect(
    () =>
      subscribeRedemptions(
        householdId,
        (value) => setRedemptions({ key: householdId, value }),
        (e) => setError(friendlyError(e, "Couldn't load rewards.")),
      ),
    [householdId],
  );

  const ready = rewards?.key === householdId && redemptions?.key === householdId;
  return {
    rewards: rewards?.key === householdId ? rewards.value : [],
    redemptions: redemptions?.key === householdId ? redemptions.value : [],
    loading: !ready && !error,
    error,
  };
}

function RewardsInner() {
  const { uid, householdId, members, ledger, dataLoading } = useReadyHousehold();
  const { toast, celebrate } = useFeedback();
  const { rewards, redemptions, loading, error } = useRewardsData(householdId);

  const [editing, setEditing] = useState<{ reward: Reward | null } | null>(null);
  const [redeeming, setRedeeming] = useState<Reward | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const wallet = useMemo(() => walletFor(ledger, redemptions, uid), [ledger, redemptions, uid]);
  const pending = redemptions.filter((r) => r.status === "pending");
  const delivered = redemptions.filter((r) => r.status === "fulfilled").slice(0, 15);
  const memberOf = (u: string) => members.find((m) => m.uid === u);

  async function addStarters() {
    setBusy("starters");
    try {
      await Promise.all(STARTER_REWARDS.map((r) => createReward(householdId, uid, r)));
      toast("Added 6 starter rewards 🎁");
    } catch (e) {
      toast(friendlyError(e, "Couldn't add rewards."), { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function confirmRedeem() {
    if (!redeeming) return;
    setBusy("redeem");
    try {
      await redeemReward(householdId, uid, redeeming);
      celebrate({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
      toast(`${redeeming.icon} Enjoy! It's waiting under “To deliver”.`);
      setRedeeming(null);
    } catch (e) {
      toast(friendlyError(e, "Couldn't redeem. Please try again."), { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, action: () => Promise<void>, done: string) {
    setBusy(id);
    try {
      await action();
      toast(done);
    } catch (e) {
      toast(friendlyError(e), { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Rewards</h1>
        <p className="text-sm text-muted">Spend the coins you earn from chores on real-life treats.</p>
      </div>

      {/* Wallet */}
      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-(image:--cq-gradient) opacity-20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-amber-100 text-4xl" aria-hidden="true">
            🪙
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Your coins</div>
            <div className="text-4xl font-extrabold tracking-tight text-ink">{dataLoading || loading ? "…" : wallet.balance}</div>
            <div className="text-xs text-muted">
              Earned {wallet.earned} · Spent {wallet.spent}
            </div>
          </div>
        </div>
        {members.length > 1 ? (
          <div className="relative mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            {members
              .filter((m) => m.uid !== uid)
              .map((m) => (
                <span key={m.uid} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-2.5 text-xs font-bold text-ink">
                  <Avatar uid={m.uid} name={m.name} emoji={m.avatar} size={22} />
                  {m.name} · 🪙 {walletFor(ledger, redemptions, m.uid).balance}
                </span>
              ))}
          </div>
        ) : null}
      </Card>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? <ListSkeleton rows={2} /> : null}

      {/* To deliver */}
      {pending.length > 0 ? (
        <section className="space-y-3" aria-labelledby="deliver-heading">
          <SectionTitle>
            <span id="deliver-heading">🚚 To deliver</span>
          </SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {pending.map((r) => {
              const who = memberOf(r.uid);
              const mine = r.uid === uid;
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden="true">
                    {r.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{r.title}</div>
                    <div className="text-xs text-muted">
                      {mine ? "You" : (who?.name ?? "Someone")} redeemed · {timeAgo(r.createdAt)}
                    </div>
                  </div>
                  {mine ? (
                    <IconButton
                      aria-label={`Cancel ${r.title} and get the coins back`}
                      disabled={busy === r.id}
                      onClick={() => act(r.id, () => cancelRedemption(householdId, r.id), "Cancelled. Coins refunded")}>
                      <X size={18} />
                    </IconButton>
                  ) : null}
                  <Button
                    size="sm"
                    variant="success"
                    loading={busy === r.id}
                    onClick={() => act(r.id, () => fulfillRedemption(householdId, r.id, uid), "Marked as delivered 🎉")}>
                    <Check size={15} aria-hidden="true" /> Done
                  </Button>
                </div>
              );
            })}
          </Card>
        </section>
      ) : null}

      {/* Shop */}
      {!loading ? (
        <section className="space-y-3" aria-labelledby="shop-heading">
          <SectionTitle
            right={
              <Button size="sm" variant="primary" onClick={() => setEditing({ reward: null })}>
                <Plus size={16} aria-hidden="true" /> New reward
              </Button>
            }>
            <span id="shop-heading">🎁 Shop</span>
          </SectionTitle>

          {rewards.length === 0 ? (
            <EmptyState
              mood="happy"
              title="No rewards yet"
              description="Agree on treats together, like picking the movie or breakfast in bed, and put a coin price on them."
              action={
                <Button variant="primary" onClick={addStarters} loading={busy === "starters"}>
                  <Sparkles size={16} aria-hidden="true" /> Add starter rewards
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {rewards.map((r) => {
                const short = r.cost - wallet.balance;
                return (
                  <Card key={r.id} className="relative flex flex-col p-4">
                    <IconButton
                      aria-label={`Edit ${r.title}`}
                      className="absolute right-1 top-1 h-9 w-9"
                      onClick={() => setEditing({ reward: r })}>
                      <Pencil size={15} />
                    </IconButton>
                    <span className="text-4xl" aria-hidden="true">
                      {r.icon}
                    </span>
                    <div className="mt-2 line-clamp-2 min-h-10 text-sm font-extrabold leading-tight text-ink">{r.title}</div>
                    <div className="mt-1 text-xs font-extrabold text-amber-700">🪙 {r.cost}</div>
                    <Button
                      size="sm"
                      variant={short <= 0 ? "primary" : "secondary"}
                      block
                      className="mt-3"
                      disabled={short > 0}
                      onClick={() => setRedeeming(r)}>
                      {short <= 0 ? (
                        <>
                          <Gift size={15} aria-hidden="true" /> Redeem
                        </>
                      ) : (
                        `${short} more`
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* Delivered */}
      {delivered.length > 0 ? (
        <section className="space-y-3" aria-labelledby="delivered-heading">
          <SectionTitle>
            <span id="delivered-heading">✅ Delivered</span>
          </SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {delivered.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 opacity-80">
                <span className="text-xl" aria-hidden="true">
                  {r.icon}
                </span>
                <div className="min-w-0 flex-1 truncate text-sm text-ink">
                  <strong>{r.uid === uid ? "You" : (memberOf(r.uid)?.name ?? "Someone")}</strong> enjoyed {r.title}
                </div>
                <span className="text-xs text-faint">{r.fulfilledAt ? timeAgo(r.fulfilledAt) : ""}</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <ConfirmSheet
        open={!!redeeming}
        title={redeeming ? `Redeem ${redeeming.title}?` : ""}
        message={
          redeeming ? (
            <>
              This spends <strong className="text-ink">🪙 {redeeming.cost}</strong> of your {wallet.balance} coins. Your
              household will see it under “To deliver”.
            </>
          ) : null
        }
        confirmLabel="Redeem"
        busy={busy === "redeem"}
        onConfirm={confirmRedeem}
        onCancel={() => setRedeeming(null)}
      />

      {editing ? (
        <RewardEditor
          key={editing.reward?.id ?? "new"}
          reward={editing.reward}
          householdId={householdId}
          uid={uid}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function RewardEditor({
  reward,
  householdId,
  uid,
  onClose,
}: {
  reward: Reward | null;
  householdId: string;
  uid: string;
  onClose: () => void;
}) {
  const { toast } = useFeedback();
  const [icon, setIcon] = useState(reward?.icon ?? "🎁");
  const [title, setTitle] = useState(reward?.title ?? "");
  const [cost, setCost] = useState(reward?.cost ?? 100);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim().length > 0 && cost > 0;

  async function save() {
    if (!valid) return;
    setBusy("save");
    setError(null);
    try {
      if (reward) await updateReward(householdId, reward.id, { icon, title, cost });
      else await createReward(householdId, uid, { icon, title, cost });
      toast(reward ? "Reward saved" : `${icon} ${title.trim()} added`);
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Couldn't save the reward."));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!reward) return;
    setBusy("delete");
    try {
      await deleteReward(householdId, reward.id);
      toast("Reward removed");
      onClose();
    } catch (e) {
      setError(friendlyError(e, "Couldn't remove the reward."));
      setConfirmDelete(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={reward ? "Edit reward" : "New reward"}
        footer={
          <div className="flex items-center gap-2">
            {reward ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} aria-hidden="true" /> Remove
              </Button>
            ) : null}
            <div className="flex-1" />
            <Button variant="primary" onClick={save} loading={busy === "save"} disabled={!valid}>
              {reward ? "Save" : "Add reward"}
            </Button>
          </div>
        }>
        <div className="space-y-5">
          <div>
            <label htmlFor="reward-title" className="mb-2 block text-sm font-bold text-ink">
              What&apos;s the treat?
            </label>
            <input
              id="reward-title"
              className="cq-input"
              placeholder="e.g. Pick the movie"
              maxLength={60}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">Icon</legend>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
              {REWARD_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  aria-label={`Use ${ic}`}
                  aria-pressed={icon === ic}
                  className={clsx(
                    "grid aspect-square place-items-center rounded-xl text-2xl transition",
                    icon === ic ? "bg-brand-soft ring-2 ring-brand" : "hover:bg-surface-2",
                  )}>
                  {ic}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">Price in coins</legend>
            <div className="grid grid-cols-3 gap-2">
              {COST_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCost(c)}
                  aria-pressed={cost === c}
                  className={clsx(
                    "rounded-2xl border py-2.5 text-sm font-extrabold transition",
                    cost === c ? "border-transparent bg-(image:--cq-gradient) text-white" : "border-line bg-surface text-ink hover:border-brand",
                  )}>
                  🪙 {c}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm text-muted">
              Or exactly
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                className="cq-input w-28"
                value={cost}
                onChange={(e) => setCost(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              />
              coins
            </label>
            <p className="mt-2 text-xs text-muted">A medium chore earns about 30 coins.</p>
          </fieldset>

          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title="Remove this reward?"
        message="It disappears from the shop. Rewards already redeemed aren't affected."
        confirmLabel="Remove"
        danger
        busy={busy === "delete"}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
