import { createClient } from "@supabase/supabase-js";
import { apiContext } from "@/server/context";
import { handle, HttpError, readJson } from "@/server/http";

/** Change password: checks the current one first. */
export const POST = handle(async (req) => {
  const ctx = await apiContext();
  const body = await readJson(req);
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  if (!current) throw new HttpError(400, "Enter your current password.");
  if (next.length < 8) throw new HttpError(400, "Use at least 8 characters.");
  if (next === current) throw new HttpError(400, "Choose a password different from your current one.");

  // A separate, in-memory client so checking the old password doesn't touch the person's session.
  const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await verifier.auth.signInWithPassword({ email: ctx.profile.email, password: current });
  if (wrong) throw new HttpError(400, "Your current password is incorrect.");
  await verifier.auth.signOut({ scope: "local" });

  const { error } = await ctx.supabase.auth.updateUser({ password: next });
  if (error) throw new HttpError(400, error.message);
  return {};
});
