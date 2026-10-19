"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2 } from "lucide-react";

import { useAuth } from "@/src/components/AuthProvider";
import { useHousehold } from "@/src/components/HouseholdProvider";
import { useFeedback } from "@/src/components/ui/Feedback";
import { Button, buttonClasses } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Display";
import { Mascot } from "@/src/components/ui/Mascot";
import { joinHouseholdByCode } from "@/src/lib/households";
import { friendlyError } from "@/src/lib/errors";

/** Landing page for shared invite links: /join?code=AB12CD */
export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = (params.get("code") ?? "").trim().toUpperCase();

  const { user, loading: authLoading } = useAuth();
  const { profile, household, loading } = useHousehold();
  const { toast } = useFeedback();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const here = `/join?code=${encodeURIComponent(code)}`;

  async function join() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const h = await joinHouseholdByCode({ uid: user.uid, code });
      toast(`Welcome to ${h.name}! 🎉`);
      // New accounts still need a name; the setup wizard picks up from there
      router.replace(profile?.name?.trim() ? "/today" : "/setup");
    } catch (e) {
      setError(
        (e as Error)?.message === "Household code not found."
          ? "This invite code doesn't work anymore. Ask for a new one."
          : friendlyError(e, "Couldn't join the household. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  let body: React.ReactNode;

  if (!code) {
    body = (
      <>
        <Mascot mood="thinking" size={88} className="mx-auto text-ink" />
        <h1 className="mt-3 text-2xl font-extrabold text-ink">This invite link is incomplete</h1>
        <p className="mt-1 text-sm text-muted">Ask for the link again, or enter the code during setup.</p>
        <Link href="/" className={buttonClasses({ variant: "primary", block: true, className: "mt-6" })}>
          Open ChoreQuest
        </Link>
      </>
    );
  } else if (authLoading || (user && loading)) {
    body = <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />;
  } else if (!user) {
    body = (
      <>
        <Mascot mood="celebrate" size={96} className="mx-auto text-ink" bob />
        <h1 className="mt-3 text-2xl font-extrabold text-ink">You&apos;re invited! 🏡</h1>
        <p className="mt-1 text-sm text-muted">Join your household on ChoreQuest to share chores and earn points together.</p>
        <CodeBadge code={code} />
        <div className="mt-6 space-y-2">
          <Link
            href={`/login?mode=signup&next=${encodeURIComponent(here)}`}
            className={buttonClasses({ variant: "primary", size: "lg", block: true })}>
            Create an account
          </Link>
          <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonClasses({ variant: "ghost", block: true })}>
            I already have an account
          </Link>
        </div>
      </>
    );
  } else if (household) {
    body = (
      <>
        <Mascot mood="thinking" size={88} className="mx-auto text-ink" />
        <h1 className="mt-3 text-2xl font-extrabold text-ink">You&apos;re already in a household</h1>
        <p className="mt-1 text-sm text-muted">
          You&apos;re a member of <strong className="text-ink">{household.name}</strong>. Being in more than one
          household isn&apos;t supported yet.
        </p>
        <Link href="/today" className={buttonClasses({ variant: "primary", block: true, className: "mt-6" })}>
          Go to today
        </Link>
      </>
    );
  } else {
    body = (
      <>
        <Mascot mood="happy" size={96} className="mx-auto text-ink" bob />
        <h1 className="mt-3 text-2xl font-extrabold text-ink">Join this household?</h1>
        <p className="mt-1 text-sm text-muted">You&apos;ll share chores and the leaderboard with its members.</p>
        <CodeBadge code={code} />
        {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
        <Button variant="primary" size="lg" block className="mt-6" onClick={join} loading={busy}>
          <Link2 size={18} aria-hidden="true" /> Join household
        </Button>
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md items-center py-6">
      <Card className="w-full p-6 text-center">{body}</Card>
    </div>
  );
}

function CodeBadge({ code }: { code: string }) {
  return (
    <div className="mx-auto mt-5 inline-block rounded-2xl border-2 border-dashed border-purple-200 bg-brand-soft px-5 py-2 font-mono text-2xl font-extrabold tracking-[0.3em] text-brand-strong">
      {code}
    </div>
  );
}
