import { requireScreen } from "@/server/guards";
import { CourseEditorPage } from "@/screens/admin/CourseEditorPage";

export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireScreen("courses", `/admin/courses/${courseId}`);
  return <CourseEditorPage />;
}
