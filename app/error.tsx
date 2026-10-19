"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button, buttonClasses } from "@/src/components/ui/Button";
import { Mascot } from "@/src/components/ui/Mascot";
import { track } from "@/src/lib/analytics";

/** Shown when a screen crashes, instead of a blank page. */
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    track("app_error", { message: error.message.slice(0, 100) });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center text-center">
      <Mascot mood="thinking" size={110} className="text-ink" />
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Oops, something broke</h1>
      <p className="mt-1 text-sm text-muted">
        Don&apos;t worry, your chores and points are safe. Try again, and if it keeps happening, restart the app.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Button variant="primary" size="lg" block onClick={reset}>
          Try again
        </Button>
        <Link href="/today" className={buttonClasses({ variant: "ghost", block: true })}>
          Go to today
        </Link>
      </div>
    </div>
  );
}
