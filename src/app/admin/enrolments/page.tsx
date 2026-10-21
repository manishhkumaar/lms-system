import { requireScreen } from "@/server/guards";
import { EnrolmentsPage } from "@/screens/admin/EnrolmentsPage";

export default async function Page() {
  await requireScreen("enrolments", "/admin/enrolments");
  return <EnrolmentsPage />;
}
