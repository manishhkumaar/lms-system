import { requireScreen } from "@/server/guards";
import { AttendancePage } from "@/screens/admin/AttendancePage";

export default async function Page() {
  await requireScreen("attendance", "/admin/attendance");
  return <AttendancePage />;
}
