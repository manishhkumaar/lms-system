import { DELIVERY, apiContext } from "@/server/context";
import { HttpError, bool, check, handle, must, readJson } from "@/server/http";
import { loadRecording } from "@/server/loaders";

/** Publish to the batch, or hide from students. */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const body = await readJson(req);
  const published = bool(body.published);
  if (published === undefined) throw new HttpError(400, "Choose whether students can see this recording.");
  const current = await loadRecording(ctx.supabase, id);
  if (published && current.status !== "ready") throw new HttpError(400, "Publish the recording once it has finished processing.");
  check(await ctx.supabase.from("recordings").update({ published }).eq("id", id));
  const recording = await loadRecording(ctx.supabase, id);
  return { result: recording, patch: { recordings: { upsert: [recording] } } };
});

/** Deletes the recording and its video file. */
export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...DELIVERY);
  const row = must(await ctx.supabase.from("recordings").select("id, file_path").eq("id", id).maybeSingle<{ id: string; file_path: string | null }>(), {
    notFound: "That recording no longer exists.",
  });
  check(await ctx.supabase.from("recordings").delete().eq("id", id));
  if (row.file_path) await ctx.supabase.storage.from("recordings").remove([row.file_path]);
  return { patch: { recordings: { remove: [id] } } };
});
