"use client";

import RequireAuth from "@/src/components/RequireAuth";
import { useAuth } from "@/src/components/AuthProvider";
import Link from "next/link";

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeInner />
    </RequireAuth>
  );
}

function HomeInner() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">ChoreQuest</h1>
          <button className="rounded-lg border px-3 py-2" onClick={signOut}>
            Sign out
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          Signed in as: {user?.email}
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            className="rounded-xl border p-4 hover:bg-gray-50"
            href="/history">
            History
          </Link>

          <Link
            className="rounded-xl border p-4 hover:bg-gray-50"
            href="/chores">
            Chores
          </Link>
          <Link
            className="rounded-xl border p-4 hover:bg-gray-50"
            href="/today">
            Today
          </Link>
          <Link
            className="rounded-xl border p-4 hover:bg-gray-50"
            href="/score">
            Score
          </Link>
          <Link className="rounded-xl border p-4 hover:bg-gray-50" href="/plan">
            Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
