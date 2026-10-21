import { redirect } from "next/navigation";
import { homePath } from "@/core/access";
import { getSession } from "@/server/context";

/** Sends people to the dashboard for their role, or to sign in. */
export default async function Home() {
  const { profile } = await getSession();
  redirect(profile && profile.status === "active" ? homePath(profile.role) : "/login");
}
