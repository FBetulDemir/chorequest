"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, ExternalLink, Gift, Infinity as InfinityIcon, Sparkles, Users } from "lucide-react";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

import RequireAuth from "@/src/components/RequireAuth";
import { useReadyHousehold } from "@/src/components/HouseholdProvider";
import { usePlan } from "@/src/components/Plus";
import { useFeedback } from "@/src/components/ui/Feedback";
import { Button } from "@/src/components/ui/Button";
import { Card, ListSkeleton } from "@/src/components/ui/Display";
import { Mascot } from "@/src/components/ui/Mascot";
import { FREE_LIMITS } from "@/src/lib/plan";
import { buyPackage, loadPackages, manageSubscriptionsUrl, purchasesAvailable, restorePurchases } from "@/src/lib/purchases";
import { isNative } from "@/src/lib/native";
import { friendlyError } from "@/src/lib/errors";

const BENEFITS = [
  { Icon: Users, title: "Unlimited members", text: `Free households have up to ${FREE_LIMITS.members}. Bring the whole family or flat.` },
  { Icon: InfinityIcon, title: "Unlimited chores", text: `Go beyond ${FREE_LIMITS.chores} chores and plan every corner of your home.` },
  { Icon: Gift, title: "Rewards shop", text: "Turn points into real treats: movie night, breakfast in bed, a lie-in." },
  { Icon: Sparkles, title: "One plan for everyone", text: "One subscription covers every member of your household." },
];

export default function PlusPage() {
  return (
    <RequireAuth>
      <PlusInner />
    </RequireAuth>
  );
}

function packageLabel(p: PurchasesPackage) {
  switch (p.packageType) {
    case "ANNUAL":
      return "Yearly";
    case "MONTHLY":
      return "Monthly";
    case "LIFETIME":
      return "Lifetime";
    default:
      return p.product.title;
  }
}

function PlusInner() {
  const { uid } = useReadyHousehold();
  const plan = usePlan();
  const { toast, celebrate } = useFeedback();

  const canBuy = isNative() && purchasesAvailable();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canBuy || plan.tier === "plus") return;
    let cancelled = false;
    loadPackages(uid)
      .then((list) => {
        if (cancelled) return;
        setPackages(list);
        // Preselect the yearly plan when there is one
        setSelected((list.find((p) => p.packageType === "ANNUAL") ?? list[0])?.identifier ?? null);
      })
      .catch((e) => !cancelled && setError(friendlyError(e, "Couldn't load subscription options.")));
    return () => {
      cancelled = true;
    };
  }, [canBuy, plan.tier, uid]);

  async function buy() {
    const pkg = packages?.find((p) => p.identifier === selected);
    if (!pkg) return;
    setBusy("buy");
    setError(null);
    try {
      const result = await buyPackage(uid, pkg);
      if (result === "purchased") {
        celebrate({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
        toast("Welcome to ChoreQuest Plus 💜");
      }
    } catch (e) {
      setError(friendlyError(e, "The purchase didn't go through. You haven't been charged."));
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setError(null);
    try {
      const active = await restorePurchases(uid);
      toast(active ? "Plus restored 💜" : "No active subscription found for this store account.");
    } catch (e) {
      setError(friendlyError(e, "Couldn't restore purchases."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <Mascot mood="celebrate" size={96} className="mx-auto text-ink" bob />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">
          ChoreQuest <span className="bg-(image:--cq-gradient) bg-clip-text text-transparent">Plus</span>
        </h1>
        <p className="mt-1 text-sm text-muted">More people, more chores, real rewards.</p>
      </div>

      {plan.reason === "open" ? (
        <Card className="p-4 text-center text-sm text-muted">
          🎉 Everything is free while ChoreQuest is in early access. Enjoy all Plus features!
        </Card>
      ) : plan.reason === "founder" ? (
        <Card className="p-4 text-center">
          <div className="font-extrabold text-ink">You&apos;re a founding household 💜</div>
          <div className="mt-1 text-sm text-muted">Plus is free for you, forever. Thank you for being here early.</div>
        </Card>
      ) : plan.tier === "plus" ? (
        <Card className="space-y-3 p-4 text-center">
          <div className="font-extrabold text-ink">Plus is active 💜</div>
          {plan.expiresAt ? (
            <div className="text-sm text-muted">Renews or ends on {new Date(plan.expiresAt).toLocaleDateString("en-GB")}</div>
          ) : null}
          {isNative() ? (
            <a href={manageSubscriptionsUrl()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-brand-strong">
              Manage subscription <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : null}
        </Card>
      ) : null}

      <Card className="divide-y divide-line overflow-hidden">
        {BENEFITS.map((b) => (
          <div key={b.title} className="flex items-start gap-3 px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-strong" aria-hidden="true">
              <b.Icon size={18} />
            </span>
            <div>
              <div className="text-sm font-extrabold text-ink">{b.title}</div>
              <div className="text-xs text-muted">{b.text}</div>
            </div>
          </div>
        ))}
      </Card>

      {plan.tier === "free" ? (
        canBuy ? (
          <div className="space-y-3">
            {packages === null && !error ? <ListSkeleton rows={2} /> : null}
            {packages?.length === 0 ? (
              <p className="text-center text-sm text-muted">Subscriptions aren&apos;t available right now. Please try again later.</p>
            ) : null}
            <div className="space-y-2" role="radiogroup" aria-label="Choose a plan">
              {packages?.map((p) => {
                const on = p.identifier === selected;
                const trial = p.product.introPrice?.price === 0 ? p.product.introPrice : null;
                return (
                  <button
                    key={p.identifier}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSelected(p.identifier)}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition",
                      on ? "border-brand bg-brand-soft" : "border-line bg-surface",
                    )}>
                    <span
                      className={clsx("grid h-6 w-6 place-items-center rounded-full border-2", on ? "border-brand bg-brand text-white" : "border-gray-300")}
                      aria-hidden="true">
                      {on ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                    <span className="flex-1">
                      <span className="block font-extrabold text-ink">{packageLabel(p)}</span>
                      {trial ? (
                        <span className="block text-xs font-bold text-emerald-600">
                          {trial.periodNumberOfUnits} {trial.periodUnit.toLowerCase()}
                          {trial.periodNumberOfUnits > 1 ? "s" : ""} free
                        </span>
                      ) : null}
                    </span>
                    <span className="text-right">
                      <span className="block font-extrabold text-ink">{p.product.priceString}</span>
                      {p.packageType === "ANNUAL" && p.product.pricePerMonthString ? (
                        <span className="block text-xs text-muted">{p.product.pricePerMonthString}/month</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {error ? <p role="alert" className="text-center text-sm text-red-600">{error}</p> : null}

            <Button variant="primary" size="lg" block onClick={buy} loading={busy === "buy"} disabled={!selected || busy !== null}>
              <Sparkles size={18} aria-hidden="true" /> Get Plus
            </Button>
            <Button variant="ghost" block onClick={restore} loading={busy === "restore"} disabled={busy !== null}>
              Restore purchases
            </Button>

            <p className="px-2 text-center text-[11px] leading-relaxed text-faint">
              Payment is charged to your {/android/i.test(navigator.userAgent) ? "Google Play" : "Apple ID"} account when
              you confirm. The subscription renews automatically unless cancelled at least 24 hours before the end of the
              current period. Manage or cancel it any time in your account settings. See our{" "}
              <Link href="/terms" className="underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        ) : (
          <Card className="p-4 text-center text-sm text-muted">
            Plus can be purchased in the ChoreQuest app for iPhone and Android. It then works here too.
          </Card>
        )
      ) : null}
    </div>
  );
}
