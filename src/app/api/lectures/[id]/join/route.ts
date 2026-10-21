import { apiContext } from "@/server/context";
import { handle, must } from "@/server/http";
import { toAttendance } from "@/server/mappers";
import type { AttendanceRow } from "@/server/rows";

/**
 * The signed-in student's Join click. Records "joined", which is not attendance. record_join()
 * checks they're in the batch, the link is published and the class is on.
 */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext("student");
  const row = must(await ctx.supabase.rpc("record_join", { p_lecture_id: id })) as AttendanceRow;
  const attendance = toAttendance(row);
  return { result: attendance, patch: { attendance: { upsert: [attendance] } } };
});
