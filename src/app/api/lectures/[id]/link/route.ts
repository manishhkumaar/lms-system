import { DELIVERY, apiContext } from "@/server/context";
import { lectureResponse, lectureRow } from "@/server/delivery";
import { HttpError, check, handle, readJson, text } from "@/server/http";
import { isValidMeetingUrl } from "@/lib/schedule";

/** Publish link / Update link. Students can Join only after a link is published. */
export const PUT = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const body = await readJson(req);
  const lecture = await lectureRow(ctx.supabase, id);
  if (lecture.status === "cancelled") throw new HttpError(400, "This lecture was cancelled, so it doesn't need a link.");
  const url = text(body.url, "a meeting link", { required: true, max: 500 }) as string;
  if (!isValidMeetingUrl(url)) throw new HttpError(400, "Enter a full https:// meeting link.");
  check(
    await ctx.supabase
      .from("lecture_links")
      .upsert({ lecture_id: id, meeting_url: url, published: true, updated_at: new Date().toISOString() }, { onConflict: "lecture_id" }),
  );
  return lectureResponse(ctx.supabase, id);
});

/** Unpublish link: students lose Join until it's published again. The URL is kept. */
export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  await lectureRow(ctx.supabase, id);
  check(await ctx.supabase.from("lecture_links").update({ published: false, updated_at: new Date().toISOString() }).eq("lecture_id", id));
  return lectureResponse(ctx.supabase, id);
});
