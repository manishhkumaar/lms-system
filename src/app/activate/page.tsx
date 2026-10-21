import { ActivatePage, type InvitationInfo } from "@/screens/auth/ActivatePage";
import { getSession } from "@/server/context";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const { supabase } = await getSession();
  const { data } = token ? await supabase.rpc("get_invitation", { p_token: token }) : { data: null };
  const invitation = (Array.isArray(data) ? data[0] : null) as InvitationInfo | null;
  return <ActivatePage token={token} invitation={invitation} />;
}
