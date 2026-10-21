import { ResetPasswordPage } from "@/screens/auth/ResetPasswordPage";
import { getSession } from "@/server/context";

/** The emailed reset link signs the person in (via /auth/callback) before landing here. */
export default async function Page() {
  const { userId } = await getSession();
  return <ResetPasswordPage hasSession={!!userId} />;
}
