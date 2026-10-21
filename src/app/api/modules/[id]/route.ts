import { apiContext, CURRICULUM } from "@/server/context";
import { courseMaterials } from "@/server/curriculum";
import { check, handle, readJson, requiredText } from "@/server/http";
import { courseIdOfModule, coursePatch } from "@/server/loaders";

/** Rename a module. */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  const title = requiredText(body.title, "a module title", 120);
  const courseId = await courseIdOfModule(ctx.supabase, id);
  check(await ctx.supabase.from("course_modules").update({ title }).eq("id", id));
  const { course, patch } = await coursePatch(ctx.supabase, courseId);
  return { result: course.modules.find((m) => m.id === id), patch };
});

/** Remove a module and its lecture templates. Its materials stay with the course, unassigned. */
export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const courseId = await courseIdOfModule(ctx.supabase, id);
  check(await ctx.supabase.from("course_modules").delete().eq("id", id));
  const { patch } = await coursePatch(ctx.supabase, courseId);
  return { patch: { ...patch, materials: { upsert: await courseMaterials(ctx.supabase, courseId) } } };
});
