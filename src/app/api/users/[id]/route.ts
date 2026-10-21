import { apiContext } from "@/server/context";
import { check, defined, handle, HttpError, must, oneOf, phone, readJson, text } from "@/server/http";
import { loadInvitedUser, loadStudent, loadUser } from "@/server/loaders";
import { STAFF_ROLES } from "@/server/people";
import type { InvitationRow, ProfileRow } from "@/server/rows";

function timeZone(v: unknown): string | undefined {
  const tz = text(v, "a time zone", { max: 64 });
  if (tz === undefined) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    throw new HttpError(400, "Choose a valid time zone.");
  }
  return tz;
}

/**
 * Anyone may change their own name, phone and time zone. Role and status changes need a Super Admin
 * (Postgres enforces this too, and keeps at least one active Super Admin).
 * An id starting with "inv-" is an open invitation: a Super Admin may change its name or role.
 */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext();
  const sb = ctx.supabase;
  const body = await readJson(req);

  if (id.startsWith("inv-")) {
    if (ctx.role !== "super-admin") throw new HttpError(403, "Only a Super Admin can change an invitation.");
    const inv = must(await sb.from("invitations").select("*").eq("id", id).is("accepted_at", null).maybeSingle<InvitationRow>(), { notFound: "That invitation no longer exists." });
    const role = oneOf(body.role, STAFF_ROLES, "a role", false);
    if (role && inv.role === "student") throw new HttpError(400, "A student's invitation can't be given a staff role.");
    const row = defined({ name: text(body.name, "their full name", { max: 120 }), role });
    if (Object.keys(row).length) check(await sb.from("invitations").update(row).eq("id", id));
    const user = await loadInvitedUser(sb, id);
    return { result: user, patch: { users: { upsert: [user] } } };
  }

  const own = id === ctx.profile.id;
  const role = oneOf(body.role, STAFF_ROLES, "a role", false);
  const status = oneOf(body.status, ["active", "suspended"] as const, "a status", false);
  if (!own && ctx.role !== "super-admin") throw new HttpError(403, "You can only change your own details.");
  if ((role || status) && ctx.role !== "super-admin") throw new HttpError(403, "Only a Super Admin can change roles or account status.");
  if (own && status === "suspended") throw new HttpError(400, "You can't suspend your own account.");
  const target = must(await sb.from("profiles").select("*").eq("id", id).maybeSingle<ProfileRow>(), { notFound: "That person no longer exists." });
  if (role && target.role === "student") throw new HttpError(400, "A student's account can't be given a staff role. Invite them as a team member instead.");
  const row = defined({
    name: text(body.name, "your full name", { max: 120 }),
    phone: body.phone === undefined ? undefined : (phone(body.phone, false) ?? null),
    time_zone: timeZone(body.timeZone),
    role,
    status,
  });
  if (Object.keys(row).length) check(await sb.from("profiles").update(row).eq("id", id));
  const user = await loadUser(sb, id);
  // A phone change is copied to the linked student record by a trigger; send that back too.
  const student = row.phone !== undefined && user.studentId ? await loadStudent(sb, user.studentId) : undefined;
  return { result: user, patch: { users: { upsert: [user] }, ...(student ? { students: { upsert: [student] } } : {}) } };
});
