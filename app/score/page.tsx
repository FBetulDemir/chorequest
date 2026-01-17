"use client";
import RequireAuth from "@/src/components/RequireAuth";

export default function ScorePage() {
  return (
    <RequireAuth>
      <div className="min-h-screen p-6">Score page (next: points ledger)</div>
    </RequireAuth>
  );
}
