"use client";

import React from "react";
import AppShell from "@/src/components/AppShell";
import { ServiceWorkerRegistration } from "@/src/components/ServiceWorkerRegistration";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ServiceWorkerRegistration />
      <AppShell>{children}</AppShell>
    </>
  );
}
