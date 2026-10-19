import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { LEGAL } from "@/src/lib/legal";

/** Readable long-form layout for the Privacy, Terms and Support pages. */
export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl pb-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden="true" /> ChoreQuest
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {LEGAL.effectiveDate}</p>
      {intro ? <p className="mt-4 text-base text-ink">{intro}</p> : null}
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ink [&_a]:font-semibold [&_a]:text-brand-strong [&_a]:underline [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted [&_ul]:space-y-1 [&_ul]:text-muted">
        {children}
      </div>
    </article>
  );
}

/** Contact line that degrades gracefully until the support email is configured. */
export function ContactEmail() {
  return LEGAL.email ? <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> : <span>(contact email to be added)</span>;
}
