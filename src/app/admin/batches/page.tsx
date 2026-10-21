import { requireScreen } from "@/server/guards";
import { BatchesPage } from "@/screens/admin/BatchesPage";

export default async function Page() {
  await requireScreen("batches", "/admin/batches");
  return <BatchesPage />;
}
