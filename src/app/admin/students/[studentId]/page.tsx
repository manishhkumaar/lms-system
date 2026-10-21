import { requireScreen } from "@/server/guards";
import { StudentProfilePage } from "@/screens/admin/StudentProfilePage";

export default async function Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  await requireScreen("students", `/admin/students/${studentId}`);
  return <StudentProfilePage />;
}
