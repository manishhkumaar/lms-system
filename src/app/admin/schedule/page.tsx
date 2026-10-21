import { requireScreen } from "@/server/guards";
import { SchedulePage } from "@/screens/admin/SchedulePage";

export default async function Page() {
  await requireScreen("schedule", "/admin/schedule");
  return <SchedulePage />;
}
