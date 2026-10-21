import { fromPg, handle, HttpError, readJson, requiredText } from "@/server/http";
import type { InvitationRow } from "@/server/rows";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Accepts an invite: creates the confirmed auth account with this password, then the profile
 * (and the student link) from the invitation. Public: the token is the credential.
 */
export const POST = handle(async (req) => {
  const admin = createAdminClient();
  if (!admin) throw new HttpError(503, "Account activation needs SUPABASE_SECRET_KEY on the server. Ask your administrator.");
  const body = await readJson(req);
  const token = requiredText(body.token, "the activation link", 200);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) throw new HttpError(400, "Use at least 8 characters.");

  const { data: invite } = await admin.from("invitations").select("*").eq("token", token).is("accepted_at", null).maybeSingle<InvitationRow>();
  if (!invite) throw new HttpError(400, "This activation link has expired or was already used. Ask your administrator for a new one.");

  const { data, error } = await admin.auth.admin.createUser({ email: invite.email, password, email_confirm: true, user_metadata: { name: invite.name } });
  if (error || !data.user) {
    if (error && (error.status === 422 || /already (been )?registered|already exists/i.test(error.message))) {
      throw new HttpError(409, "An account with this email already exists. Sign in instead, or reset your password.");
    }
    if (error && /password/i.test(error.message)) throw new HttpError(400, error.message);
    console.error("Activation failed", error);
    throw new HttpError(500, "Couldn't create your account. Try again.");
  }

  const accepted = await admin.rpc("accept_invitation", { p_token: token, p_user_id: data.user.id });
  if (accepted.error) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw fromPg(accepted.error);
  }
  return { result: { email: invite.email, role: invite.role } };
});
