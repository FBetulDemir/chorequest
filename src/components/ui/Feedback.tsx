"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useIsClient } from "@/src/lib/useIsClient";
import { haptic } from "@/src/lib/native";

type ToastTone = "default" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
};

type Burst = { id: number; x: number; y: number; points?: number };

type FeedbackContextValue = {
  /** Small message at the bottom of the screen, optionally with an action like "Undo". */
  toast: (
    message: string,
    opts?: { tone?: ToastTone; action?: Toast["action"]; durationMs?: number },
  ) => void;
  /** Confetti and a "+points" bubble at a screen position, plus a short vibration. */
  celebrate: (opts: { x: number; y: number; points?: number }) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const CONFETTI_COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#60a5fa", "#fcd34d"];

function ConfettiBurst({ burst }: { burst: Burst }) {
  // Random spread is fixed per burst, so re-renders don't reshuffle it
  const [pieces] = useState(() =>
    Array.from({ length: 22 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 22 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 70;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 30,
        rot: Math.random() * 720 - 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      };
    }),
  );

  return (
    <div className="pointer-events-none fixed z-[90]" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={clsx("absolute block h-2 w-2", p.round ? "rounded-full" : "rounded-[2px]")}
          style={
            {
              background: p.color,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              animation: "cq-confetti 800ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
            } as React.CSSProperties
          }
        />
      ))}
      {burst.points ? (
        <span
          className="absolute left-0 top-0 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-1 text-sm font-extrabold text-white shadow-lg"
          style={{ animation: "cq-float-up 1000ms ease-out forwards" }}>
          +{burst.points}
        </span>
      ) : null}
    </div>
  );
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(1);
  const isClient = useIsClient();

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<FeedbackContextValue["toast"]>(
    (message, opts = {}) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, tone: opts.tone ?? "default", action: opts.action }]);
      window.setTimeout(() => dismiss(id), opts.durationMs ?? (opts.action ? 5500 : 3200));
    },
    [dismiss],
  );

  const celebrate = useCallback<FeedbackContextValue["celebrate"]>(({ x, y, points }) => {
    const id = nextId.current++;
    setBursts((list) => [...list, { id, x, y, points }]);
    window.setTimeout(() => setBursts((list) => list.filter((b) => b.id !== id)), 1100);
    haptic("success");
  }, []);

  const value = useMemo(() => ({ toast, celebrate }), [toast, celebrate]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {isClient
        ? createPortal(
            <>
              {bursts.map((b) => (
                <ConfettiBurst key={b.id} burst={b} />
              ))}
              <div
                className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
                style={{ bottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
                aria-live="polite"
                role="status">
                {toasts.map((t) => (
                  <div
                    key={t.id}
                    className={clsx(
                      "animate-slide-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lifted",
                      t.tone === "error" ? "bg-red-600 text-white" : "bg-[#1f1633] text-white dark:bg-[#f3f0fa] dark:text-[#1f1633]",
                    )}>
                    <span className="flex-1">{t.message}</span>
                    {t.action ? (
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 font-extrabold text-violet-300 hover:bg-white/10 dark:text-violet-700 dark:hover:bg-black/5"
                        onClick={() => {
                          t.action!.onClick();
                          dismiss(t.id);
                        }}>
                        {t.action.label}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
