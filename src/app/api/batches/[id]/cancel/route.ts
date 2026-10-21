import { apiContext, DELIVERY } from "@/server/context";
import { check, handle, HttpError } from "@/server/http";
import { loadBatch, loadLectures } from "@/server/loaders";

/** Cancel a batch and every lecture that hasn't started yet. Past lectures and recordings stay. */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const before = await loadBatch(ctx.supabase, id);
  if (before.lifecycle === "cancelled") throw new HttpError(400, `${before.code} is already cancelled.`);
  check(await ctx.supabase.from("batches").update({ lifecycle: "cancelled" }).eq("id", id));
  const res = await ctx.supabase.from("lectures").update({ status: "cancelled" }).eq("batch_id", id).gt("start_at", new Date().toISOString()).neq("status", "cancelled").select("id");
  check(res);
  const batch = await loadBatch(ctx.supabase, id);
  const lectures = await loadLectures(ctx.supabase, (res.data || []).map((l: { id: string }) => l.id));
  return { result: batch, patch: { batches: { upsert: [batch] }, lectures: { upsert: lectures } } };
});
