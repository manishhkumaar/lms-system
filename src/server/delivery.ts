import "server-only";
/* Shared rules for the delivery routes: lectures, meeting links, recordings and attendance. */
import type { ApiResponse, ID, Lecture } from "@/data/types";
import type { ServerClient } from "./context";
import { HttpError, must } from "./http";
import { loadLecture } from "./loaders";
import type { LectureRow } from "./rows";

export async function lectureRow(sb: ServerClient, id: ID): Promise<LectureRow> {
  return must(await sb.from("lectures").select("*").eq("id", id).maybeSingle<LectureRow>(), { notFound: "That lecture no longer exists." });
}

/** The lecture (with its link) as the result, and as the patch. */
export async function lectureResponse(sb: ServerClient, id: ID): Promise<ApiResponse<Lecture>> {
  const lecture = await loadLecture(sb, id);
  return { result: lecture, patch: { lectures: { upsert: [lecture] } } };
}

/** Date + start/end wall-clock times, with the messages people see when one is missing or wrong. */
export function lectureTimes(body: Record<string, unknown>): { date: string; startTime: string; endTime: string } {
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const endTime = typeof body.endTime === "string" ? body.endTime.trim() : "";
  if (!date) throw new HttpError(400, "Choose a date.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Enter the date as a calendar date.");
  if (!startTime || !endTime) throw new HttpError(400, "Enter a start and end time.");
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) throw new HttpError(400, "Enter the times as HH:MM.");
  if (endTime <= startTime) throw new HttpError(400, "The end time must be after the start time.");
  return { date, startTime, endTime };
}

/** An IANA zone the runtime knows, e.g. Asia/Kolkata. */
export function timeZoneOf(v: unknown, fallback: string): string {
  const tz = typeof v === "string" && v.trim() ? v.trim() : fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new HttpError(400, "Choose a valid time zone.");
  }
  return tz;
}

export const hasStarted = (l: LectureRow, now = Date.now()) => new Date(l.start_at).getTime() <= now;
export const hasEnded = (l: LectureRow, now = Date.now()) => new Date(l.end_at).getTime() <= now;

/** How long a recording's streaming link stays valid. */
export const RECORDING_URL_SECONDS = 3 * 3600;
