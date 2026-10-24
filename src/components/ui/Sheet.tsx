"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Button, IconButton } from "@/src/components/ui/Button";

// Page scrolling is locked while any sheet is open. Sheets can stack (an editor
// with a "Delete?" confirmation on top) and close in any order, so count them
// rather than having each one restore the value it saw when it opened.
let openSheets = 0;
let overflowBeforeSheets = "";

function lockPageScroll() {
  if (openSheets === 0) {
    overflowBeforeSheets = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  openSheets += 1;
}

function unlockPageScroll() {
  openSheets = Math.max(0, openSheets - 1);
  if (openSheets === 0) document.body.style.overflow = overflowBeforeSheets;
}

/**
 * Bottom sheet on phones, centered dialog on larger screens.
 * Closes on Escape or a tap on the backdrop, and locks page scroll while open.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    lockPageScroll();

    // Focus the first field (or the panel) for keyboard and screen-reader users
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button:not([data-sheet-close])",
    );
    (first ?? panelRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockPageScroll();
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade-in absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "animate-slide-up pb-safe relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-lifted outline-none sm:rounded-[28px]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
        )}>
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-gray-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <h2 id={titleId} className="text-lg font-extrabold text-ink">
            {title}
          </h2>
          <IconButton aria-label="Close" data-sheet-close onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** A small "are you sure?" sheet, used instead of the browser's confirm(). */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button block onClick={onCancel}>
            Cancel
          </Button>
          <Button block variant={danger ? "danger" : "primary"} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }>
      <div className="text-sm text-muted">{message}</div>
    </Sheet>
  );
}
