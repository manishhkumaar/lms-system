import { apiContext, PEOPLE } from "@/server/context";
import { email, handle, HttpError, must, oneOf, phone, readJson, requiredText, text } from "@/server/http";
import { assertCourse, dateOrNull, LEAD_SOURCES, LEAD_STAGES, leadResponse, logActivity, ownerName } from "@/server/people";

/** Add lead. Admissions, Operations and Super Admin. */
export const POST = handle(async (req) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const body = await readJson(req);
  const courseId = text(body.courseId, "a course", { max: 64 });
  if (!courseId) throw new HttpError(400, "Choose the course they're interested in.");
  await assertCourse(sb, courseId);
  const ownerId = text(body.ownerId, "an owner", { max: 64 });
  if (ownerId) await ownerName(sb, ownerId);
  const stage = oneOf(body.stage, LEAD_STAGES, "a stage", false) || "new";
  if (stage === "enrolled") throw new HttpError(400, "Add the lead first, then use Enrol student to enrol them into a batch.");
  const note = text(body.note, "a note", { max: 2000 });
  const row = must(
    await sb
      .from("leads")
      .insert({
        name: requiredText(body.name, "the lead's full name", 120),
        email: email(body.email),
        phone: phone(body.phone),
        city: text(body.city, "a city", { max: 80 }) ?? null,
        course_id: courseId,
        source: oneOf(body.source, LEAD_SOURCES, "where the lead came from"),
        stage,
        owner_id: ownerId ?? null,
        follow_up_on: dateOrNull(body.followUpOn, "a valid follow-up date") ?? null,
      })
      .select("id")
      .single<{ id: string }>(),
  );
  await logActivity(sb, row.id, ctx.profile.name, "stage", "Lead created");
  if (note) await logActivity(sb, row.id, ctx.profile.name, "note", note);
  return leadResponse(sb, row.id);
});
