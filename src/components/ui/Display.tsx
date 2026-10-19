"use client";

import React from "react";
import Link from "next/link";
import clsx from "clsx";
import { Mascot, type MascotMood } from "@/src/components/ui/Mascot";

// ---------- Card ----------

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("cq-card", className)} {...rest} />;
}

// ---------- Skeleton ----------

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("cq-skeleton", className)} />;
}

/** Placeholder for a list of chore rows while data loads. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="cq-card flex items-center gap-3 p-4">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ---------- Avatar ----------

const AVATAR_COLORS = [
  "from-violet-400 to-fuchsia-500",
  "from-sky-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-lime-400 to-green-500",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({
  uid,
  name,
  emoji,
  size = 36,
  className,
  ring = false,
}: {
  uid: string;
  name: string;
  emoji?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      title={name}
      aria-label={name}
      role="img"
      className={clsx(
        "inline-grid shrink-0 select-none place-items-center rounded-full bg-gradient-to-br font-extrabold text-white",
        AVATAR_COLORS[hash(uid) % AVATAR_COLORS.length],
        ring && "ring-2 ring-surface",
        className,
      )}
      style={{ width: size, height: size, fontSize: emoji ? size * 0.55 : size * 0.38 }}>
      {emoji || initials(name)}
    </span>
  );
}

// ---------- Progress ring ----------

export function ProgressRing({
  value,
  size = 72,
  stroke = 8,
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--cq-brand-soft)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#cq-ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
        <defs>
          <linearGradient id="cq-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

// ---------- Empty state ----------

export function EmptyState({
  mood = "happy",
  title,
  description,
  action,
  compact = false,
}: {
  mood?: MascotMood;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={clsx("cq-card text-center", compact ? "p-6" : "p-8")}>
      <Mascot mood={mood} size={compact ? 64 : 96} className="mx-auto text-ink" bob={mood === "celebrate"} />
      <div className="mt-3 text-lg font-extrabold text-ink">{title}</div>
      {description ? <div className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ---------- Segmented control ----------

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx("flex rounded-2xl bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all",
              active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Points pill ----------

export function PointsPill({ points, className }: { points: number; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700",
        className,
      )}>
      <span aria-hidden="true">🪙</span>
      {points}
      <span className="sr-only">points</span>
    </span>
  );
}

// ---------- Section heading ----------

export function SectionTitle({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-between gap-3", className)}>
      <h2 className="text-base font-extrabold text-ink">{children}</h2>
      {right ?? null}
    </div>
  );
}

// ---------- List row ----------

/** Tappable settings-style row with an icon, text and a chevron. */
export function ListRow({
  icon,
  title,
  description,
  right,
  onClick,
  href,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const body = (
    <>
      <span
        className={clsx(
          "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
          danger ? "bg-red-50 text-red-600" : "bg-brand-soft text-brand-strong",
        )}
        aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("block text-sm font-bold", danger ? "text-red-600" : "text-ink")}>{title}</span>
        {description ? <span className="block truncate text-xs text-muted">{description}</span> : null}
      </span>
      {right ?? <span className="text-faint" aria-hidden="true">›</span>}
    </>
  );
  const cls = "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
