import { requireScreen } from "@/server/guards";
import { StudentsPage } from "@/screens/admin/StudentsPage";

export default async function Page() {
  await requireScreen("students", "/admin/students");
  return <StudentsPage />;
}
