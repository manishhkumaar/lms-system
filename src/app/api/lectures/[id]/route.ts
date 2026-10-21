import { DELIVERY, apiContext } from "@/server/context";
import { lectureResponse, lectureRow } from "@/server/delivery";
import { HttpError, check, handle, readJson, text } from "@/server/http";

/** Edit a lecture's title, instructor or agenda. An empty instructor or agenda clears it. */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const body = await readJson(req);
  await lectureRow(ctx.supabase, id);
  const row: Record<string, string | null> = {};
  if ("title" in body) row.title = text(body.title, "a lecture title", { required: true, max: 200 }) as string;
  if ("instructor" in body) row.instructor = text(body.instructor, "an instructor", { max: 120 }) || null;
  if ("agenda" in body) row.agenda = text(body.agenda, "an agenda", { max: 4000 }) || null;
  if (!Object.keys(row).length) throw new HttpError(400, "Nothing to change.");
  check(await ctx.supabase.from("lectures").update(row).eq("id", id));
  return lectureResponse(ctx.supabase, id);
});
