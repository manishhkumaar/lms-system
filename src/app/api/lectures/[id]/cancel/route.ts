import { DELIVERY, apiContext } from "@/server/context";
import { hasEnded, lectureResponse, lectureRow } from "@/server/delivery";
import { HttpError, check, handle } from "@/server/http";

/** Cancel lecture. The batch is notified; the row stays so the schedule shows what changed. */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const lecture = await lectureRow(ctx.supabase, id);
  if (lecture.status === "cancelled") throw new HttpError(400, "This lecture is already cancelled.");
  if (hasEnded(lecture)) throw new HttpError(400, "This lecture has already ended, so it can't be cancelled.");
  check(await ctx.supabase.from("lectures").update({ status: "cancelled" }).eq("id", id));
  return lectureResponse(ctx.supabase, id);
});
