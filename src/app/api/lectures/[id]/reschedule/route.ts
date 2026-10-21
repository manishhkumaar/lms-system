import { DELIVERY, apiContext } from "@/server/context";
import { hasStarted, lectureResponse, lectureRow, lectureTimes, timeZoneOf } from "@/server/delivery";
import { HttpError, check, handle, readJson } from "@/server/http";
import { zonedISO } from "@/lib/time";

/** Moves a lecture. The meeting link moves with it; the first original time is kept. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const body = await readJson(req);
  const lecture = await lectureRow(ctx.supabase, id);
  if (lecture.status === "cancelled") throw new HttpError(400, "This lecture was cancelled. Schedule a new one instead.");
  if (hasStarted(lecture)) throw new HttpError(400, "This lecture has already started, so it can't be moved.");
  const { date, startTime, endTime } = lectureTimes(body);
  const timeZone = timeZoneOf(body.timeZone, lecture.time_zone);
  const start = zonedISO(date, startTime, timeZone);
  if (new Date(start).getTime() <= Date.now()) throw new HttpError(400, "Choose a time in the future.");
  check(
    await ctx.supabase
      .from("lectures")
      .update({
        start_at: start,
        end_at: zonedISO(date, endTime, timeZone),
        time_zone: timeZone,
        status: "rescheduled",
        previous_start: lecture.previous_start || lecture.start_at,
      })
      .eq("id", id),
  );
  return lectureResponse(ctx.supabase, id);
});
