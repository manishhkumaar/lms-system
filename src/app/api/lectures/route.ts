import { DELIVERY, apiContext } from "@/server/context";
import { lectureResponse, lectureTimes, timeZoneOf } from "@/server/delivery";
import { HttpError, check, handle, must, readJson, text } from "@/server/http";
import type { BatchRow, LectureRow } from "@/server/rows";
import { isValidMeetingUrl } from "@/lib/schedule";
import { zonedISO } from "@/lib/time";

/** Schedule lecture: the next number in the batch, times stored with their zone. */
export const POST = handle(async (req) => {
  const ctx = await apiContext(...DELIVERY);
  const sb = ctx.supabase;
  const body = await readJson(req);
  if (typeof body.batchId !== "string" || !body.batchId) throw new HttpError(400, "Choose a batch.");
  const batch = must(await sb.from("batches").select("*").eq("id", body.batchId).maybeSingle<BatchRow>(), { notFound: "That batch no longer exists." });
  if (batch.lifecycle === "cancelled") throw new HttpError(400, `${batch.name} is cancelled, so it can't have new lectures.`);
  const title = text(body.title, "a lecture title", { required: true, max: 200 }) as string;
  const { date, startTime, endTime } = lectureTimes(body);
  const timeZone = timeZoneOf(body.timeZone, batch.time_zone);
  const meetingUrl = text(body.meetingUrl, "a meeting link", { max: 500 });
  if (meetingUrl && !isValidMeetingUrl(meetingUrl)) throw new HttpError(400, "Enter a full https:// meeting link.");

  const last = must(await sb.from("lectures").select("number").eq("batch_id", batch.id).order("number", { ascending: false }).limit(1)) as Array<{ number: number }>;
  const created = must(
    await sb
      .from("lectures")
      .insert({
        batch_id: batch.id,
        number: (last[0]?.number || 0) + 1,
        title,
        start_at: zonedISO(date, startTime, timeZone),
        end_at: zonedISO(date, endTime, timeZone),
        time_zone: timeZone,
        instructor: text(body.instructor, "an instructor", { max: 120 }) || batch.instructors[0] || null,
        agenda: text(body.agenda, "an agenda", { max: 4000 }) || null,
        status: "scheduled",
      })
      .select("*")
      .single<LectureRow>(),
  );
  if (meetingUrl) {
    check(await sb.from("lecture_links").insert({ lecture_id: created.id, meeting_url: meetingUrl, published: body.publish === true }));
  }
  return lectureResponse(sb, created.id);
});
