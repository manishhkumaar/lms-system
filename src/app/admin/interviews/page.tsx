import { requireScreen } from "@/server/guards";
import { InterviewsPage } from "@/screens/admin/InterviewsPage";

export default async function Page() {
  await requireScreen("interviews", "/admin/interviews");
  return <InterviewsPage />;
}
