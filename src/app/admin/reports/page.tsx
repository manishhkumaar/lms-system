import { requireScreen } from "@/server/guards";
import { ReportsPage } from "@/screens/admin/ReportsPage";

export default async function Page() {
  await requireScreen("reports", "/admin/reports");
  return <ReportsPage />;
}
