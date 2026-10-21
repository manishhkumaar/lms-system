import { plural } from "@/lib/format";
import { apiContext, DELIVERY } from "@/server/context";
import { instructorList, seatsFilled, weekdays } from "@/server/curriculum";
import { check, dateStr, defined, handle, HttpError, int, must, oneOf, readJson, text, timeStr } from "@/server/http";
import { loadBatch } from "@/server/loaders";
import type { BatchRow } from "@/server/rows";

/**
 * Edit a batch: seats, instructors, usual slot and days, dates, or open a draft for enrolment.
 * Lectures already scheduled keep their times. Cancelling goes through /cancel.
 */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const body = await readJson(req);
  const before = must(await ctx.supabase.from("batches").select("*").eq("id", id).maybeSingle<BatchRow>(), { notFound: "That batch no longer exists." });

  const lifecycle = oneOf(body.lifecycle, ["draft", "active", "cancelled"] as const, "a status", false);
  if (lifecycle === "cancelled") throw new HttpError(400, "Use Cancel batch to cancel it, so its upcoming lectures are cancelled too.");
  if (before.lifecycle === "cancelled" && lifecycle) throw new HttpError(400, "This batch is cancelled and can't be reopened. Create a new batch instead.");

  const capacity = int(body.capacity, "the capacity", { min: 1, max: 1000 });
  if (capacity !== undefined) {
    const filled = await seatsFilled(ctx.supabase, id);
    if (capacity < filled) throw new HttpError(400, `Capacity can't be below the ${plural(filled, "student")} already enrolled.`);
  }

  const slotStart = body.slotStart === undefined ? before.slot_start : timeStr(body.slotStart, "a start time");
  const slotEnd = body.slotEnd === undefined ? before.slot_end : timeStr(body.slotEnd, "an end time");
  if (slotEnd <= slotStart) throw new HttpError(400, "The end time must be after the start time.");
  const startDate = dateStr(body.startDate, "a start date", false) ?? before.start_date;
  const endDate = dateStr(body.endDate, "an end date", false) ?? before.end_date;
  if (endDate < startDate) throw new HttpError(400, "The end date can't be before the start date.");

  const name = text(body.name, "a batch name", { max: 120 });
  if (name === "") throw new HttpError(400, "Enter a batch name.");

  const row = defined({
    name,
    capacity,
    instructors: instructorList(body.instructors),
    slot_start: body.slotStart === undefined ? undefined : slotStart,
    slot_end: body.slotEnd === undefined ? undefined : slotEnd,
    days: body.days === undefined ? undefined : weekdays(body.days),
    time_zone: text(body.timeZone, "a time zone", { max: 64 }),
    lifecycle,
    start_date: body.startDate === undefined ? undefined : startDate,
    end_date: body.endDate === undefined ? undefined : endDate,
  });
  if (Object.keys(row).length) check(await ctx.supabase.from("batches").update(row).eq("id", id));
  const batch = await loadBatch(ctx.supabase, id);
  return { result: batch, patch: { batches: { upsert: [batch] } } };
});
