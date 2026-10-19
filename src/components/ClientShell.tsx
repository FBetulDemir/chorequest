"use client";

import React from "react";
import AppShell from "@/src/components/AppShell";
import { HouseholdProvider } from "@/src/components/HouseholdProvider";
import { NativeShell } from "@/src/components/NativeShell";
import { RouteTracker } from "@/src/components/RouteTracker";
import { ServiceWorkerRegistration } from "@/src/components/ServiceWorkerRegistration";
import { FeedbackProvider } from "@/src/components/ui/Feedback";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HouseholdProvider>
      <FeedbackProvider>
        <ServiceWorkerRegistration />
        <NativeShell />
        <RouteTracker />
        <AppShell>{children}</AppShell>
      </FeedbackProvider>
    </HouseholdProvider>
  );
}
