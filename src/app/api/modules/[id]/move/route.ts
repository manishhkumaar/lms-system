import { apiContext, CURRICULUM } from "@/server/context";
import { modulesOf } from "@/server/curriculum";
import { check, handle, HttpError, readJson } from "@/server/http";
import { courseIdOfModule, coursePatch } from "@/server/loaders";

/** Move a module one place up (dir -1) or down (dir 1) in the curriculum. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  if (body.dir !== -1 && body.dir !== 1) throw new HttpError(400, "Choose to move the module up or down.");
  const courseId = await courseIdOfModule(ctx.supabase, id);
  const mods = await modulesOf(ctx.supabase, courseId);
  const i = mods.findIndex((m) => m.id === id);
  const j = i + (body.dir as number);
  if (i >= 0 && j >= 0 && j < mods.length) {
    const order = mods.slice();
    [order[i], order[j]] = [order[j], order[i]];
    // Renumber the whole list so positions stay unique even after earlier deletions.
    for (let k = 0; k < order.length; k++) {
      if (order[k].position !== k) check(await ctx.supabase.from("course_modules").update({ position: k }).eq("id", order[k].id));
    }
  }
  const { patch } = await coursePatch(ctx.supabase, courseId);
  return { patch };
});
