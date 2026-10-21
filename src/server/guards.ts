import "server-only";
import { redirect } from "next/navigation";
import { ACCESS, ADMIN_ROLES, homePath, type AdminKey } from "@/core/access";
import type { Role } from "@/data/types";
import { getSession } from "./context";
import type { ProfileRow } from "./rows";

function deny(params: Record<string, string>): never {
  redirect(`/access-denied?${new URLSearchParams(params).toString()}`);
}

/**
 * For portal layouts: a signed-in, active person with one of these roles. Signed-out visitors are
 * already sent to /login by the proxy; this handles missing profiles, suspension and wrong roles.
 */
export async function requirePortal(roles: Role[], portal: "admin" | "learn"): Promise<ProfileRow> {
  const { profile, userId } = await getSession();
  if (!userId) redirect("/login");
  if (!profile) deny({ reason: "no-profile" });
  if (profile.status !== "active") deny({ reason: "suspended" });
  if (!roles.includes(profile.role)) deny({ from: `/${portal}`, allowed: roles.join(",") });
  return profile;
}

export const requireAdmin = () => requirePortal(ADMIN_ROLES, "admin");
export const requireStudent = () => requirePortal(["student"], "learn");

/** For admin screens: the access table in src/core/access.ts, enforced on the server. */
export async function requireScreen(key: AdminKey, from: string): Promise<ProfileRow> {
  const profile = await requireAdmin();
  if (!ACCESS[key].includes(profile.role)) deny({ screen: key, from });
  return profile;
}

/** For sign-in pages: send signed-in people to their dashboard. */
export async function redirectIfSignedIn() {
  const { profile } = await getSession();
  if (profile && profile.status === "active") redirect(homePath(profile.role));
}
