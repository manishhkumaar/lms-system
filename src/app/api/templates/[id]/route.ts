import { apiContext, CURRICULUM } from "@/server/context";
import { check, defined, handle, HttpError, int, readJson, text } from "@/server/http";
import { courseIdOfTemplate, coursePatch } from "@/server/loaders";

/** Edit a lecture template. An empty summary clears it. */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  const row = defined({
    title: text(body.title, "a lecture title", { max: 160 }),
    duration_mins: int(body.durationMins, "the length in minutes", { min: 15, max: 600 }),
    summary: body.summary === undefined ? undefined : text(body.summary, "a summary", { max: 2000 }) || null,
  });
  if (row.title === "") throw new HttpError(400, "Enter a lecture title.");
  const courseId = await courseIdOfTemplate(ctx.supabase, id);
  if (Object.keys(row).length) check(await ctx.supabase.from("lecture_templates").update(row).eq("id", id));
  const { course, patch } = await coursePatch(ctx.supabase, courseId);
  return { result: course.modules.flatMap((m) => m.lectures).find((t) => t.id === id), patch };
});

/** Remove a lecture template. Lectures already scheduled from it in batches stay. */
export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const courseId = await courseIdOfTemplate(ctx.supabase, id);
  check(await ctx.supabase.from("lecture_templates").delete().eq("id", id));
  const { patch } = await coursePatch(ctx.supabase, courseId);
  return { patch };
});
