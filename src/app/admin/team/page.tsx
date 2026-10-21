import { requireScreen } from "@/server/guards";
import { TeamPage } from "@/screens/admin/TeamPage";

export default async function Page() {
  await requireScreen("team", "/admin/team");
  return <TeamPage />;
}
