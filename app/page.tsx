"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/src/components/RequireAuth";

export default function HomePage() {
  return (
    <RequireAuth>
      <RedirectToToday />
    </RequireAuth>
  );
}

function RedirectToToday() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/today");
  }, [router]);

  return <div className="p-6">Loading...</div>;
}
