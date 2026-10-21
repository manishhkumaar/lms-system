import { apiContext, CURRICULUM } from "@/server/context";
import { nextPosition } from "@/server/curriculum";
import { handle, int, must, readJson, requiredText, text } from "@/server/http";
import { courseIdOfModule, coursePatch } from "@/server/loaders";
import type { TemplateRow } from "@/server/rows";

/** Add a lecture template at the end of a module. Each batch of the course gets one live lecture per template. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  const row = {
    module_id: id,
    title: requiredText(body.title, "a lecture title", 160),
    duration_mins: int(body.durationMins, "the length in minutes", { min: 15, max: 600, required: true }),
    summary: text(body.summary, "a summary", { max: 2000 }) || null,
    position: await nextPosition(ctx.supabase, "lecture_templates", "module_id", id),
  };
  const courseId = await courseIdOfModule(ctx.supabase, id);
  const saved = must(await ctx.supabase.from("lecture_templates").insert(row).select("*").single<TemplateRow>());
  const { course, patch } = await coursePatch(ctx.supabase, courseId);
  return { result: course.modules.flatMap((m) => m.lectures).find((t) => t.id === saved.id), patch };
});
