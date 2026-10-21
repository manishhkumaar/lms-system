import { LoginPage } from "@/screens/auth/LoginPage";
import { redirectIfSignedIn } from "@/server/guards";

export default async function Page() {
  await redirectIfSignedIn();
  return <LoginPage />;
}
