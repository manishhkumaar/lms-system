import { apiContext } from "@/server/context";
import { RECORDING_URL_SECONDS } from "@/server/delivery";
import { HttpError, handle, must } from "@/server/http";

/**
 * A short-lived streaming link. Row-level security already hides recordings a student can't
 * watch (unpublished, or another batch's), so those come back as not found.
 */
export const GET = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext();
  const row = must(await ctx.supabase.from("recordings").select("id, file_path").eq("id", id).maybeSingle<{ id: string; file_path: string | null }>(), {
    notFound: "That recording isn't available.",
  });
  if (!row.file_path) return { result: null };
  const { data, error } = await ctx.supabase.storage.from("recordings").createSignedUrl(row.file_path, RECORDING_URL_SECONDS);
  if (error || !data) throw new HttpError(404, "The video file is missing. Ask Operations to upload it again.");
  return { result: data.signedUrl };
});
