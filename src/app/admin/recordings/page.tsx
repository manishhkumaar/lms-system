import { requireScreen } from "@/server/guards";
import { RecordingsPage } from "@/screens/admin/RecordingsPage";

export default async function Page() {
  await requireScreen("recordings", "/admin/recordings");
  return <RecordingsPage />;
}
