"use client";
import { useUser } from "@/auth/AuthContext";
import { AdmissionsDashboard } from "./overview/AdmissionsDashboard";
import { DesignerDashboard } from "./overview/DesignerDashboard";
import { OperationsDashboard } from "./overview/OperationsDashboard";
import "./overview.css";

/** Role-based dashboard: each role lands on what it acts on. */
export function DashboardPage() {
  const user = useUser();
  if (user.role === "admissions") return <AdmissionsDashboard />;
  if (user.role === "course-designer") return <DesignerDashboard />;
  return <OperationsDashboard />;
}
