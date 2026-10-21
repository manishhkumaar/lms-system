import { AccessDeniedPage } from "@/screens/auth/AccessDeniedPage";
import type { Role } from "@/data/types";
import { getSession } from "@/server/context";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile } = await getSession();
  const reason = sp.reason === "suspended" || sp.reason === "no-profile" ? sp.reason : profile?.status === "suspended" ? "suspended" : undefined;
  return (
    <AccessDeniedPage
      person={profile ? { name: profile.name, role: profile.role } : null}
      screen={sp.screen}
      from={sp.from}
      allowed={sp.allowed ? (sp.allowed.split(",") as Role[]) : undefined}
      reason={reason}
    />
  );
}
