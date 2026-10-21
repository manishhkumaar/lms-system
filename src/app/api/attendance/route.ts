import { DELIVERY, apiContext } from "@/server/context";
import { hasEnded, lectureRow } from "@/server/delivery";
import { HttpError, handle, must, oneOf, readJson } from "@/server/http";
import { toAttendance } from "@/server/mappers";
import type { AttendanceRow } from "@/server/rows";

const VERIFICATIONS = ["unverified", "present", "absent"] as const;

/** Operations confirms or corrects one student's attendance. A Join click alone never counts. */
export const PUT = handle(async (req) => {
  const ctx = await apiContext(...DELIVERY);
  const sb = ctx.supabase;
  const body = await readJson(req);
  if (typeof body.lectureId !== "string" || !body.lectureId) throw new HttpError(400, "Choose a lecture.");
  if (typeof body.studentId !== "string" || !body.studentId) throw new HttpError(400, "Choose a student.");
  const verification = oneOf(body.verification, VERIFICATIONS, "an attendance status") as (typeof VERIFICATIONS)[number];
  const lecture = await lectureRow(sb, body.lectureId);
  if (lecture.status === "cancelled") throw new HttpError(400, "This lecture was cancelled, so there's no attendance to mark.");
  if (!hasEnded(lecture)) throw new HttpError(400, "Mark attendance after the lecture ends.");
  const { data: enrolment } = await sb
    .from("enrolments")
    .select("id")
    .eq("student_id", body.studentId)
    .eq("batch_id", lecture.batch_id)
    .in("status", ["active", "completed"])
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!enrolment) throw new HttpError(400, "This student isn't in this lecture's batch.");

  const verified = verification !== "unverified";
  const row = must(
    await sb
      .from("attendance")
      .upsert(
        {
          lecture_id: lecture.id,
          student_id: body.studentId,
          verification,
          verified_by: verified ? "operations" : null,
          verified_at: verified ? new Date().toISOString() : null,
        },
        { onConflict: "lecture_id,student_id" },
      )
      .select("*")
      .single<AttendanceRow>(),
  );
  const attendance = toAttendance(row);
  return { result: attendance, patch: { attendance: { upsert: [attendance] } } };
});
