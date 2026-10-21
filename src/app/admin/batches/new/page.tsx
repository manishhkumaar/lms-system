import { requireScreen } from "@/server/guards";
import { BatchSetupPage } from "@/screens/admin/BatchSetupPage";

export default async function Page() {
  await requireScreen("batches", "/admin/batches/new");
  return <BatchSetupPage />;
}
