import type { Batch, DB, ID } from "@/data/types";
import { formatDate } from "@/lib/format";
import { tzLabel } from "@/lib/time";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function sortDays(days: Batch["days"]): Batch["days"] {
  return [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

/** "Mon, Wed, Fri" */
export function daysLabel(days: Batch["days"]) {
  return sortDays(days).join(", ");
}

/** "Mon, Wed, Fri · 18:30–20:00 IST" */
export function scheduleLabel(b: Pick<Batch, "days" | "slotStart" | "slotEnd" | "timeZone">) {
  return `${daysLabel(b.days)} · ${b.slotStart}–${b.slotEnd} ${tzLabel(b.timeZone)}`;
}

/** "21 Oct 2026 – 12 Dec 2026" */
export function datesLabel(b: Pick<Batch, "startDate" | "endDate">) {
  return `${formatDate(b.startDate)} – ${formatDate(b.endDate)}`;
}

/** The next free two-digit batch number for a course: "09". */
export function nextBatchNumber(db: DB, courseId: ID): string {
  const nums = db.batches
    .filter((b) => b.courseId === courseId)
    .map((b) => Number(b.code.split("-").pop()))
    .filter((n) => !Number.isNaN(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, "0");
}

/** "Batch 07" from "FSW-07" */
export function batchShort(b: Pick<Batch, "code">) {
  return `Batch ${b.code.split("-").pop()}`;
}
