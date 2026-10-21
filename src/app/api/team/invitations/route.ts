import { apiContext } from "@/server/context";
import { email, handle, HttpError, must, oneOf, readJson, requiredText } from "@/server/http";
import { loadInvitedUser } from "@/server/loaders";
import { emailTaken, STAFF_ROLES } from "@/server/people";

/** Invite member. Super Admin only. They activate their account from the link. */
export const POST = handle(async (req) => {
  const ctx = await apiContext("super-admin");
  const sb = ctx.supabase;
  const body = await readJson(req);
  const name = requiredText(body.name, "their full name", 120);
  const address = email(body.email)!;
  const role = oneOf(body.role, STAFF_ROLES, "a role")!;
  if (await emailTaken(sb, address)) throw new HttpError(409, "Someone with this email already has an account.");
  const row = must(await sb.from("invitations").insert({ name, email: address, role, invited_by: ctx.profile.id }).select("id, token").single<{ id: string; token: string }>(), {
    unique: "Someone with this email already has an account.",
  });
  const user = await loadInvitedUser(sb, row.id);
  return { result: { user, activationPath: `/activate?token=${row.token}` }, patch: { users: { upsert: [user] } } };
});
