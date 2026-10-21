import { apiContext, CURRICULUM } from "@/server/context";
import { LEVELS, templateCount } from "@/server/curriculum";
import { bool, check, defined, handle, HttpError, int, oneOf, readJson, text } from "@/server/http";
import { loadCourse } from "@/server/loaders";

/** Edit a course's details, publish it, move it back to draft, or switch materials on/off. */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  const status = oneOf(body.status, ["draft", "published"] as const, "a status", false);
  if (status === "published" && (await templateCount(ctx.supabase, id)) === 0) {
    throw new HttpError(400, "Add at least one lecture before publishing.");
  }
  const row = defined({
    title: text(body.title, "a course title", { max: 120 }),
    summary: body.summary === undefined ? undefined : (text(body.summary, "a summary", { max: 2000 }) ?? ""),
    level: oneOf(body.level, LEVELS, "a level", false),
    duration_weeks: int(body.durationWeeks, "the duration in weeks", { min: 1, max: 104 }),
    fee: int(body.fee, "the fee", { min: 0 }),
    status,
    materials_enabled: bool(body.materialsEnabled),
  });
  if (row.title === "") throw new HttpError(400, "Enter a course title.");
  const res = await ctx.supabase.from("courses").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).select("id");
  check(res);
  if (!res.data?.length) throw new HttpError(404, "That course no longer exists.");
  const course = await loadCourse(ctx.supabase, id);
  return { result: course, patch: { courses: { upsert: [course] } } };
});
