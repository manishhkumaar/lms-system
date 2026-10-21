import { requireScreen } from "@/server/guards";
import { SettingsPage } from "@/screens/admin/SettingsPage";

export default async function Page() {
  await requireScreen("settings", "/admin/settings");
  return <SettingsPage />;
}
