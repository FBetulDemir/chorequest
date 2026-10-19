"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Chores now live on the Household tab; keep old links and shortcuts working.
export default function ChoresRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/household#chores");
  }, [router]);
  return null;
}
