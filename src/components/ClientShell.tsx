"use client";

import React from "react";
import AppShell from "@/src/components/AppShell";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
