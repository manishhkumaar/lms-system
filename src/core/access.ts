/*
 * Role-based access. The Sidebar hides what a role can't use, but hiding is not access control:
 * every admin route is also guarded here, and a forbidden URL lands on Access Denied.
 * A real backend must enforce the same table on every API call.
 */
import type { Role } from "@/data/types";

export const ADMIN_ROLES: Role[] = ["super-admin", "operations", "course-designer", "admissions"];

export type AdminKey =
  | "dashboard"
  | "reports"
  | "leads"
  | "interviews"
  | "enrolments"
  | "courses"
  | "materials"
  | "batches"
  | "schedule"
  | "lectures"
  | "students"
  | "recordings"
  | "attendance"
  | "team"
  | "settings";

const ALL_ADMIN = ADMIN_ROLES;

export const ACCESS: Record<AdminKey, Role[]> = {
  dashboard: ALL_ADMIN,
  reports: ["super-admin", "operations"],
  leads: ["super-admin", "operations", "admissions"],
  interviews: ["super-admin", "admissions"],
  enrolments: ["super-admin", "operations", "admissions"],
  courses: ["super-admin", "course-designer"],
  materials: ["super-admin", "course-designer"],
  batches: ["super-admin", "operations"],
  schedule: ["super-admin", "operations"],
  lectures: ["super-admin", "operations"],
  students: ["super-admin", "operations", "admissions"],
  recordings: ["super-admin", "operations"],
  attendance: ["super-admin", "operations"],
  team: ["super-admin"],
  settings: ["super-admin"],
};

export const SCREEN_LABEL: Record<AdminKey, string> = {
  dashboard: "Dashboard",
  reports: "Reports",
  leads: "Leads CRM",
  interviews: "Interviews",
  enrolments: "Enrolments",
  courses: "Courses",
  materials: "Materials library",
  batches: "Batch Management",
  schedule: "Schedule",
  lectures: "Lecture Details",
  students: "Student Directory",
  recordings: "Recordings",
  attendance: "Attendance",
  team: "Team & Roles",
  settings: "Settings",
};

export function canAccess(role: Role | undefined, key: AdminKey): boolean {
  return !!role && ACCESS[key].includes(role);
}

export const ADMIN_PATH: Record<AdminKey, string> = {
  dashboard: "/admin",
  reports: "/admin/reports",
  leads: "/admin/leads",
  interviews: "/admin/interviews",
  enrolments: "/admin/enrolments",
  courses: "/admin/courses",
  materials: "/admin/materials",
  batches: "/admin/batches",
  schedule: "/admin/schedule",
  lectures: "/admin/schedule",
  students: "/admin/students",
  recordings: "/admin/recordings",
  attendance: "/admin/attendance",
  team: "/admin/team",
  settings: "/admin/settings",
};

/** Sidebar item key → path. For Admissions, the "students" item is Enrolments. */
export function navPath(role: Role, key: string): string {
  if (role === "student") return STUDENT_PATH[key] || "/learn";
  if (role === "admissions" && key === "students") return ADMIN_PATH.enrolments;
  return ADMIN_PATH[key as AdminKey] || "/admin";
}

/** Current path → the Sidebar item to highlight. */
export function activeNavKey(role: Role, pathname: string): string {
  if (role === "student") {
    const seg = pathname.split("/")[2] || "";
    if (seg === "live") return "timeline";
    return seg || "dashboard";
  }
  const seg = pathname.split("/")[2] || "dashboard";
  if (seg === "lectures") return "schedule";
  // Admissions' "Enrolments" item has the key "students"; other roles reach Enrolments from Students.
  if (seg === "enrolments") return "students";
  return seg;
}

export const STUDENT_PATH: Record<string, string> = {
  dashboard: "/learn",
  courses: "/learn/courses",
  timeline: "/learn/timeline",
  recordings: "/learn/recordings",
  materials: "/learn/materials",
  profile: "/learn/profile",
};

export function homePath(role: Role | undefined): string {
  if (!role) return "/login";
  return role === "student" ? "/learn" : "/admin";
}
