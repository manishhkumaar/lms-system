"use client";
import type { ReactNode } from "react";
import { DataGate } from "@/auth/DataGate";
import { AdminLayout } from "./AdminLayout";
import { StudentLayout } from "./StudentLayout";

/** Admin / Operations portal: loads the person's data, then Sidebar + Topbar around each screen. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <DataGate>
      <AdminLayout>{children}</AdminLayout>
    </DataGate>
  );
}

/** Student portal: loads the student's own data, then Sidebar or bottom tabs around each screen. */
export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <DataGate>
      <StudentLayout>{children}</StudentLayout>
    </DataGate>
  );
}
