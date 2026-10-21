import { requireScreen } from "@/server/guards";
import { MaterialsLibraryPage } from "@/screens/admin/MaterialsLibraryPage";

export default async function Page() {
  await requireScreen("materials", "/admin/materials");
  return <MaterialsLibraryPage />;
}
