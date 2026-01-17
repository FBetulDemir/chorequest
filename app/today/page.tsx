"use client";
import RequireAuth from "@/src/components/RequireAuth";

export default function TodayPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen p-6">
        Today page (next: instances + complete)
      </div>
    </RequireAuth>
  );
}
