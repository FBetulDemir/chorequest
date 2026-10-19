"use client";

import React, { useId } from "react";
import clsx from "clsx";

export type MascotMood = "happy" | "celebrate" | "sleepy" | "thinking";

/**
 * "Tidy", the ChoreQuest house. Used in empty states, onboarding and celebrations.
 */
export function Mascot({
  mood = "happy",
  size = 96,
  className,
  bob = false,
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
  bob?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const ink = "#1f1633";

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={clsx(bob && "animate-bob", className)}
      role="img"
      aria-label="ChoreQuest mascot">
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.6" stopColor="#d946ef" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="111" rx="30" ry="5" fill="currentColor" opacity="0.1" />

      {/* Body */}
      <path
        d="M60 14c3 0 5 1 7 3l34 30c3 3 4 6 4 10v35c0 7-5 12-12 12H27c-7 0-12-5-12-12V57c0-4 1-7 4-10l34-30c2-2 4-3 7-3z"
        fill={`url(#body-${id})`}
      />
      {/* Window shine */}
      <path d="M30 56c0-3 2-6 6-8" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.45" fill="none" />

      {/* Cheeks */}
      <ellipse cx="37" cy="79" rx="6.5" ry="4" fill="#fff" opacity="0.35" />
      <ellipse cx="83" cy="79" rx="6.5" ry="4" fill="#fff" opacity="0.35" />

      {/* Eyes */}
      {mood === "celebrate" ? (
        <g stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M40 68q6-7 12 0" />
          <path d="M68 68q6-7 12 0" />
        </g>
      ) : mood === "sleepy" ? (
        <g stroke={ink} strokeWidth="4" strokeLinecap="round">
          <path d="M40 67h12" />
          <path d="M68 67h12" />
        </g>
      ) : (
        <g>
          <circle cx="46" cy="66" r="5.5" fill={ink} />
          <circle cx="74" cy="66" r="5.5" fill={ink} />
          <circle cx="47.8" cy="64" r="1.8" fill="#fff" />
          <circle cx="75.8" cy="64" r="1.8" fill="#fff" />
        </g>
      )}

      {/* Mouth */}
      {mood === "celebrate" ? (
        <path d="M48 79q12 16 24 0z" fill={ink} />
      ) : mood === "sleepy" ? (
        <path d="M55 83q5 3 10 0" stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      ) : mood === "thinking" ? (
        <path d="M53 83h14" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <path d="M50 79q10 10 20 0" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
      )}

      {/* Extras */}
      {mood === "sleepy" ? (
        <text x="88" y="34" fontSize="16" fontWeight="800" fill="#a78bfa">
          z
        </text>
      ) : (
        <path d="M97 14l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#fcd34d" />
      )}
      {mood === "celebrate" ? (
        <>
          <path d="M18 22l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="#fcd34d" />
          <circle cx="104" cy="44" r="3" fill="#34d399" />
          <circle cx="14" cy="48" r="2.5" fill="#60a5fa" />
        </>
      ) : null}
    </svg>
  );
}
