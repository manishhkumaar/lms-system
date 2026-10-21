import type { ReactNode } from "react";
import { AdminShell } from "@/layouts/PortalShells";
import { requireAdmin } from "@/server/guards";

/** Staff only. Each screen below also checks the role access table. */
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
