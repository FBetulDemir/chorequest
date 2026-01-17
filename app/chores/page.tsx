"use client";
import RequireAuth from "@/src/components/RequireAuth";

export default function ChoresPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen p-6">Chores page (next: Firestore CRUD)</div>
    </RequireAuth>
  );
}
