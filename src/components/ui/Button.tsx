"use client";

import React from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "text-white bg-(image:--cq-gradient) shadow-[0_8px_20px_rgba(139,92,246,0.28)] hover:shadow-[0_12px_26px_rgba(139,92,246,0.36)] hover:-translate-y-px",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
  success:
    "text-white bg-linear-to-r from-emerald-500 to-green-500 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:from-emerald-600 hover:to-green-600",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-xs rounded-xl gap-1.5",
  md: "h-11 px-4 text-sm rounded-xl gap-2",
  lg: "h-13 px-6 text-base rounded-2xl gap-2",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
};

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex select-none items-center justify-center font-bold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...rest}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

/** Round icon-only button; always pass an aria-label. */
export function IconButton({
  className,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink active:scale-95 disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}
