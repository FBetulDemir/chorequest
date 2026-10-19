"use client";

import React from "react";
import AppShell from "@/src/components/AppShell";
import { HouseholdProvider } from "@/src/components/HouseholdProvider";
import { ServiceWorkerRegistration } from "@/src/components/ServiceWorkerRegistration";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HouseholdProvider>
      <ServiceWorkerRegistration />
      <AppShell>{children}</AppShell>
    </HouseholdProvider>
  );
}
