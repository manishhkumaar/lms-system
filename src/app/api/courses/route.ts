import { apiContext, CURRICULUM } from "@/server/context";
import { LEVELS } from "@/server/curriculum";
import { bool, handle, HttpError, int, must, oneOf, readJson, requiredText, text } from "@/server/http";
import { loadCourse } from "@/server/loaders";
import type { CourseRow } from "@/server/rows";

/** New course. Starts as a draft owned by the person creating it. */
export const POST = handle(async (req) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  const code = requiredText(body.code, "a course code", 6).toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(code)) throw new HttpError(400, "Use 2 to 6 capital letters or digits for the code, like FSW.");
  const row = {
    code,
    title: requiredText(body.title, "a course title", 120),
    summary: text(body.summary, "a summary", { max: 2000 }) ?? "",
    level: oneOf(body.level, LEVELS, "a level"),
    duration_weeks: int(body.durationWeeks, "the duration in weeks", { min: 1, max: 104, required: true }),
    fee: int(body.fee, "the fee", { min: 0, required: true }),
    materials_enabled: bool(body.materialsEnabled) ?? true,
    status: "draft",
    designer_id: ctx.profile.id,
  };
  const saved = must(await ctx.supabase.from("courses").insert(row).select("*").single<CourseRow>(), { unique: `Course code ${code} is already used.` });
  const course = await loadCourse(ctx.supabase, saved.id);
  return { result: course, patch: { courses: { upsert: [course] } } };
});
