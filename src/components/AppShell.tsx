"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/src/components/AuthProvider";
import { getUserProfile } from "@/src/lib/profile";

const nav = [
  { href: "/today", label: "Today", icon: "🏠" },
  { href: "/plan", label: "Plan", icon: "📅" },
  { href: "/score", label: "Score", icon: "🏆" },
  { href: "/chores", label: "Chores", icon: "⚙️" },
];

function UserMenu() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="cq-btn text-sm"
        type="button"
        aria-label="User menu">
        ⋮
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 min-w-40 rounded-xl border bg-white shadow-lg overflow-hidden">
            <Link
              href="/setup"
              onClick={() => setOpen(false)}
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition flex items-center gap-2 font-medium">
              <span>⚙️</span>
              <span>Setup</span>
            </Link>
            <Link
              href="/history"
              onClick={() => setOpen(false)}
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition flex items-center gap-2 font-medium">
              <span>📜</span>
              <span>History</span>
            </Link>
            <div className="border-t border-gray-100" />
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition flex items-center gap-2 text-red-600 font-medium disabled:opacity-50"
              type="button">
              <span>🚪</span>
              <span>{loading ? "Signing out..." : "Sign Out"}</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    async function load() {
      if (!user) return;
      const p = await getUserProfile(user.uid);
      setName(p?.name ?? "");
    }
    load();
  }, [user]);

  return (
    <div className="min-h-screen pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur">
        <div className="cq-container px-6 py-4">
          {/* THIS is the row that needs justify-between */}
          <div className="flex items-center justify-between">
            {/* Left block */}
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl grid place-items-center text-white font-bold"
                style={{
                  background:
                    "linear-gradient(90deg, var(--cq-purple), var(--cq-pink))",
                }}>
                ✦
              </div>

              <div>
                <div className="text-sm font-semibold leading-4">
                  ChoreQuest
                </div>
                <div className="text-xs text-gray-500">Make chores fun!</div>
              </div>
            </div>

            {/* Right block */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link
                    href="/setup"
                    className="cq-pill hover:opacity-90 active:opacity-80 transition"
                    title="Go to setup / profile"
                    aria-label="Go to setup / profile">
                    👤 {name || user.email}
                  </Link>
                  <UserMenu />
                </>
              ) : (
                <Link className="cq-btn" href="/login">
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Page content */}
      <main className="cq-container px-6 py-6">{children}</main>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-5xl px-6 pb-4">
          <div className="cq-card-soft px-3 py-2 backdrop-blur bg-white/70">
            <div className="grid grid-cols-4">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "mx-1 rounded-xl px-3 py-2 text-center text-xs transition " +
                      (active
                        ? "bg-purple-50 text-purple-700"
                        : "text-gray-500 hover:bg-gray-50")
                    }>
                    <div className="text-base">{item.icon}</div>
                    <div className="mt-1">{item.label}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
