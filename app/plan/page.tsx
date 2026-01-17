"use client";
import RequireAuth from "@/src/components/RequireAuth";

export default function PlanPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen p-6">Plan page (next: schedule rules)</div>
    </RequireAuth>
  );
}
