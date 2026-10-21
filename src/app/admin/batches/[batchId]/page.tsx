import { requireScreen } from "@/server/guards";
import { BatchDetailsPage } from "@/screens/admin/BatchDetailsPage";

export default async function Page({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  await requireScreen("batches", `/admin/batches/${batchId}`);
  return <BatchDetailsPage />;
}
