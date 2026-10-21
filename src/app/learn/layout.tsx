import type { ReactNode } from "react";
import { StudentShell } from "@/layouts/PortalShells";
import { requireStudent } from "@/server/guards";

/** Students only. What each student can see inside is limited by row-level security. */
export default async function LearnLayout({ children }: { children: ReactNode }) {
  await requireStudent();
  return <StudentShell>{children}</StudentShell>;
}
