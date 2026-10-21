import { DELIVERY, apiContext } from "@/server/context";
import { handle, must } from "@/server/http";
import { loadAttendance } from "@/server/loaders";

/**
 * Imports the meeting provider's participant report for an ended lecture: students it saw are
 * present, everyone else enrolled is absent. Operations' own corrections are kept.
 */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const counts = must(await ctx.supabase.rpc("import_provider_attendance", { p_lecture_id: id })) as { present: number; absent: number };
  const attendance = await loadAttendance(ctx.supabase, id);
  return { result: { present: counts.present, absent: counts.absent }, patch: { attendance: { upsert: attendance } } };
});
