"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, House, Sun, Trophy, type LucideIcon } from "lucide-react";

import { useAuth } from "@/src/components/AuthProvider";
import { useHousehold } from "@/src/components/HouseholdProvider";
import { Avatar } from "@/src/components/ui/Display";
import { Mascot } from "@/src/components/ui/Mascot";

type NavItem = { href: string; label: string; Icon: LucideIcon; match: string[] };

const NAV: NavItem[] = [
  { href: "/today", label: "Today", Icon: Sun, match: ["/today"] },
  { href: "/plan", label: "Plan", Icon: CalendarDays, match: ["/plan"] },
  { href: "/score", label: "Leaders", Icon: Trophy, match: ["/score", "/rewards"] },
  { href: "/household", label: "Household", Icon: House, match: ["/household", "/chores", "/history"] },
];

// Full-screen pages with their own layout
const CHROMELESS = ["/login", "/welcome"];
// Onboarding: top bar only, no tabs
const NO_TABS = ["/setup"];

function isActive(pathname: string, item: NavItem) {
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { profile } = useHousehold();

  if (CHROMELESS.includes(pathname)) {
    return <main className="cq-container pt-safe pb-safe min-h-dvh">{children}</main>;
  }

  const showTabs = !!user && !NO_TABS.includes(pathname);
  const name = profile?.name?.trim() || user?.email || "";

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <header className="pt-safe sticky top-0 z-40 border-b border-line bg-glass backdrop-blur-xl">
        <div className="cq-container flex h-16 items-center justify-between">
          <Link href={user ? "/today" : "/welcome"} className="flex items-center gap-2.5" aria-label="ChoreQuest home">
            <Mascot size={36} className="text-ink" />
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-tight text-ink">ChoreQuest</div>
              <div className="text-[11px] font-semibold text-muted">Make chores fun</div>
            </div>
          </Link>

          {user ? (
            <Link
              href="/profile"
              className={clsx(
                "flex items-center gap-2 rounded-full py-1 pl-3 pr-1 transition hover:bg-surface-2",
                pathname === "/profile" && "bg-brand-soft",
              )}
              aria-label="Your profile and settings">
              <span className="hidden max-w-40 truncate text-sm font-bold text-ink sm:block">{name}</span>
              <Avatar uid={user.uid} name={name || "?"} emoji={profile?.avatar} size={36} />
            </Link>
          ) : (
            <Link className="cq-btn" href="/login">
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className={clsx("cq-container py-5", showTabs ? "pb-32" : "pb-10")}>{children}</main>

      {/* Bottom tabs */}
      {showTabs ? (
        <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-50">
          <div className="mx-auto max-w-lg px-3 pb-3">
            <div className="grid grid-cols-4 gap-1 rounded-[26px] border border-line bg-glass p-1.5 shadow-lifted backdrop-blur-xl">
              {NAV.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex flex-col items-center gap-0.5 rounded-[20px] py-2 text-[11px] font-bold transition-all",
                      active ? "bg-brand-soft text-brand-strong" : "text-muted hover:text-ink",
                    )}>
                    <item.Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
