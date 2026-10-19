"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { LocalNotifications } from "@capacitor/local-notifications";
import { pathFromAppLink } from "@/src/lib/invite";

// Screens where Android's back button should leave the app instead of going back
const ROOT_SCREENS = ["/", "/today", "/welcome"];

/** Native-only behaviour for the iOS/Android shell. Renders nothing; a no-op on the web. */
export function NativeShell() {
  const router = useRouter();
  const pathname = usePathname();

  // Status bar text follows the app theme
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sync = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
      if (Capacitor.getPlatform() === "android") {
        StatusBar.setBackgroundColor({ color: dark ? "#0f0b1a" : "#faf7ff" }).catch(() => {});
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Android hardware back button
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    const handle = App.addListener("backButton", () => {
      const path = window.location.pathname.replace(/\/$/, "") || "/";
      if (ROOT_SCREENS.includes(path)) App.exitApp();
      else router.back();
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [router]);

  // Invite links and chorequest:// links open the matching screen
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = App.addListener("appUrlOpen", ({ url }) => {
      const path = pathFromAppLink(url);
      if (path) router.push(path);
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [router]);

  // Tapping a reminder opens the screen it points to
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
      const path = typeof notification.extra?.path === "string" ? notification.extra.path : "/today";
      router.push(path);
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [router]);

  // Mark the document so CSS can tell it's running inside the app
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add("native", `native-${Capacitor.getPlatform()}`);
    }
  }, [pathname]);

  return null;
}
