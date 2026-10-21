import { apiContext } from "@/server/context";
import { check, handle } from "@/server/http";
import { loadRecording } from "@/server/loaders";

/** Counts a view. record_view() checks the person may watch it. */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext();
  check(await ctx.supabase.rpc("record_view", { p_recording_id: id }));
  const recording = await loadRecording(ctx.supabase, id);
  return { patch: { recordings: { upsert: [recording] } } };
});
