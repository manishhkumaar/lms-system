import { requireScreen } from "@/server/guards";
import { CoursesPage } from "@/screens/admin/CoursesPage";

export default async function Page() {
  await requireScreen("courses", "/admin/courses");
  return <CoursesPage />;
}
