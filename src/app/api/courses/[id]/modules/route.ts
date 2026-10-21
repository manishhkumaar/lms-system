import { apiContext, CURRICULUM } from "@/server/context";
import { nextPosition } from "@/server/curriculum";
import { handle, must, readJson, requiredText } from "@/server/http";
import { coursePatch, loadCourse } from "@/server/loaders";
import type { ModuleRow } from "@/server/rows";

/** Add a module at the end of the course's curriculum. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  const title = requiredText(body.title, "a module title", 120);
  await loadCourse(ctx.supabase, id); // 404 if the course is gone
  const position = await nextPosition(ctx.supabase, "course_modules", "course_id", id);
  const saved = must(await ctx.supabase.from("course_modules").insert({ course_id: id, title, position }).select("*").single<ModuleRow>());
  const { course, patch } = await coursePatch(ctx.supabase, id);
  return { result: course.modules.find((m) => m.id === saved.id), patch };
});
