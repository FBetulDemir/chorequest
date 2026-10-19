"use client";

import { useEffect, useState } from "react";
import { startOfLocalDayMs } from "@/src/lib/schedule";

/**
 * Start of the local day, in ms. Re-renders when the date changes, so a
 * screen left open overnight rolls over to the new day.
 */
export function useTodayStartMs(): number {
  const [dayStart, setDayStart] = useState(() => startOfLocalDayMs(Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = startOfLocalDayMs(Date.now());
      setDayStart((cur) => (cur === next ? cur : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return dayStart;
}
