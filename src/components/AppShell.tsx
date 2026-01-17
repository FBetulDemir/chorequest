"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Home, ListChecks, LogOut, Trophy } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import clsx from "clsx";

const nav = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/score", label: "Score", icon: Trophy },
  { href: "/chores", label: "Chores", icon: ListChecks },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 flex items-center justify-between px-4 bg-white/70 backdrop-blur border-b border-black/10">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center text-white text-sm">
            ✨
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">ChoreQuest</div>
            <div className="text-xs text-gray-500">Make chores fun!</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-white border border-black/10 text-sm">
            👷 {user?.displayName ?? user?.email ?? "User"}
          </div>
          <button
            className="h-9 w-9 rounded-xl bg-gray-100 grid place-items-center"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 backdrop-blur border-t border-black/10">
        <div className="max-w-3xl mx-auto h-full px-4 flex items-center justify-between">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center justify-center w-20 h-12 rounded-xl text-xs",
                  active
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-500 hover:bg-gray-50",
                )}>
                <Icon size={18} />
                <div className="mt-1">{item.label}</div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
