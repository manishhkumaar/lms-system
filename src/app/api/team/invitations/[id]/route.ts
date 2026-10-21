import { apiContext, PEOPLE } from "@/server/context";
import { check, handle, HttpError, must } from "@/server/http";
import type { InvitationRow } from "@/server/rows";

/** Revoke an open invitation. Super Admin, or Operations / Admissions for student invites. */
export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const inv = must(await sb.from("invitations").select("*").eq("id", id).is("accepted_at", null).maybeSingle<InvitationRow>(), { notFound: "That invitation no longer exists." });
  if (inv.role !== "student" && ctx.role !== "super-admin") throw new HttpError(403, "Only a Super Admin can revoke staff invitations.");
  check(await sb.from("invitations").delete().eq("id", id));
  return { patch: { users: { remove: [id] } } };
});
