import { apiContext } from "@/server/context";
import { handle } from "@/server/http";
import { loadUser } from "@/server/loaders";

/** The signed-in person. 401 when signed out, 403 when the account isn't set up or is suspended. */
export const GET = handle(async () => {
  const ctx = await apiContext();
  await ctx.supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", ctx.profile.id);
  return { result: await loadUser(ctx.supabase, ctx.profile.id) };
});
