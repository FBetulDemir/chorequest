"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/src/lib/analytics";

/** Screen views for analytics (no-op without consent). */
export function RouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    track("screen_view", { firebase_screen: pathname, firebase_screen_class: pathname });
  }, [pathname]);
  return null;
}
