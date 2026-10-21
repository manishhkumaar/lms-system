import { requireScreen } from "@/server/guards";
import { LeadsPage } from "@/screens/admin/LeadsPage";

export default async function Page() {
  await requireScreen("leads", "/admin/leads");
  return <LeadsPage />;
}
