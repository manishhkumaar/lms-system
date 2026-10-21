import { sessionDates, shortCourseTitle } from "@/lib/schedule";
import { addDays, zonedISO } from "@/lib/time";
import { apiContext, DELIVERY } from "@/server/context";
import { instructorList, weekdays } from "@/server/curriculum";
import { bool, check, dateStr, handle, HttpError, int, must, readJson, requiredText, timeStr } from "@/server/http";
import { loadBatch, loadCourse, loadLectures } from "@/server/loaders";
import type { BatchRow } from "@/server/rows";

/**
 * New batch of a published course: one scheduled delivery with dates, seats and a usual slot.
 * Optionally creates one lecture per lecture template on the batch's days.
 */
export const POST = handle(async (req) => {
  const ctx = await apiContext(...DELIVERY);
  const body = await readJson(req);
  const courseId = requiredText(body.courseId, "a course", 64);
  const course = await loadCourse(ctx.supabase, courseId).catch(() => {
    throw new HttpError(400, "Choose a course.");
  });
  const draft = bool(body.draft) ?? false;
  if (course.status !== "published" && !draft) throw new HttpError(400, `Publish ${course.title} first, or save the batch as a draft.`);

  const number = requiredText(body.number, "a batch number", 3);
  if (!/^\d{1,3}$/.test(number) || Number(number) < 1) throw new HttpError(400, "Enter the batch number as digits, like 09.");
  const num = number.padStart(2, "0");
  const code = `${course.code}-${num}`;
  const startDate = dateStr(body.startDate, "a start date")!;
  const days = weekdays(body.days);
  const slotStart = timeStr(body.slotStart, "a start time");
  const slotEnd = timeStr(body.slotEnd, "an end time");
  if (slotEnd <= slotStart) throw new HttpError(400, "The end time must be after the start time.");
  const timeZone = requiredText(body.timeZone, "a time zone", 64);
  const capacity = int(body.capacity, "the capacity", { min: 1, max: 1000, required: true })!;
  const instructors = instructorList(body.instructors) || [];

  const templates = course.modules.flatMap((m) => m.lectures);
  const dates = sessionDates(startDate, days, Math.max(1, templates.length || course.durationWeeks * days.length));
  const row = {
    code,
    name: `${shortCourseTitle(course.title)} · Batch ${num}`,
    course_id: course.id,
    start_date: startDate,
    end_date: dates[dates.length - 1] || addDays(startDate, course.durationWeeks * 7),
    capacity,
    instructors,
    time_zone: timeZone,
    days,
    slot_start: slotStart,
    slot_end: slotEnd,
    lifecycle: draft ? "draft" : "active",
    owner_id: ctx.profile.id,
  };
  const saved = must(await ctx.supabase.from("batches").insert(row).select("*").single<BatchRow>(), { unique: `Batch ${code} already exists.` });

  let lectureIds: string[] = [];
  if (bool(body.generateLectures) && templates.length) {
    const lectures = templates.map((t, i) => ({
      batch_id: saved.id,
      number: i + 1,
      title: t.title,
      start_at: zonedISO(dates[i], slotStart, timeZone),
      end_at: zonedISO(dates[i], slotEnd, timeZone),
      time_zone: timeZone,
      instructor: instructors[0] || null,
      status: "scheduled",
      agenda: t.summary || null,
    }));
    const res = await ctx.supabase.from("lectures").insert(lectures).select("id");
    if (res.error) {
      await ctx.supabase.from("batches").delete().eq("id", saved.id);
      check(res);
    }
    lectureIds = (res.data || []).map((l: { id: string }) => l.id);
  }

  const batch = await loadBatch(ctx.supabase, saved.id);
  return { result: batch, patch: { batches: { upsert: [batch] }, lectures: { upsert: await loadLectures(ctx.supabase, lectureIds) } } };
});
