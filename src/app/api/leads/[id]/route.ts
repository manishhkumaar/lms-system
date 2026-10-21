import { apiContext, PEOPLE } from "@/server/context";
import { check, defined, email, handle, HttpError, must, oneOf, phone, readJson, text } from "@/server/http";
import { assertCourse, dateOrNull, LEAD_SOURCES, leadResponse, ownerName, timestamp } from "@/server/people";
import type { LeadRow } from "@/server/rows";

/** Edit a lead's details. Stage changes go through /stage and /enrol. */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const body = await readJson(req);
  if (body.stage !== undefined) throw new HttpError(400, "Change the stage from the pipeline instead.");
  must(await sb.from("leads").select("id").eq("id", id).maybeSingle<Pick<LeadRow, "id">>(), { notFound: "That lead no longer exists." });
  const courseId = text(body.courseId, "a course", { max: 64 });
  if (courseId) await assertCourse(sb, courseId);
  const ownerId = body.ownerId === null ? null : text(body.ownerId, "an owner", { max: 64 });
  if (ownerId) await ownerName(sb, ownerId);
  const row = defined({
    name: text(body.name, "the lead's full name", { max: 120 }),
    email: body.email === undefined ? undefined : email(body.email),
    phone: body.phone === undefined ? undefined : phone(body.phone),
    city: body.city === undefined ? undefined : (text(body.city, "a city", { max: 80 }) ?? null),
    course_id: courseId,
    source: oneOf(body.source, LEAD_SOURCES, "where the lead came from", false),
    owner_id: ownerId,
    interview_at: timestamp(body.interviewAt, "the interview date and time"),
    follow_up_on: dateOrNull(body.followUpOn, "a valid follow-up date"),
  });
  if (Object.keys(row).length) check(await sb.from("leads").update(row).eq("id", id));
  return leadResponse(sb, id);
});

/** Delete a lead and its notes. */
export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  must(await ctx.supabase.from("leads").select("id").eq("id", id).maybeSingle(), { notFound: "That lead no longer exists." });
  check(await ctx.supabase.from("leads").delete().eq("id", id));
  return { patch: { leads: { remove: [id] } } };
});
