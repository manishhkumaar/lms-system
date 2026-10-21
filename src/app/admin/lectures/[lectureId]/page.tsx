import { requireScreen } from "@/server/guards";
import { LectureDetailsPage } from "@/screens/admin/LectureDetailsPage";

export default async function Page({ params }: { params: Promise<{ lectureId: string }> }) {
  const { lectureId } = await params;
  await requireScreen("lectures", `/admin/lectures/${lectureId}`);
  return <LectureDetailsPage />;
}
