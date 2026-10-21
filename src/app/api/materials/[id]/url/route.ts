import { apiContext } from "@/server/context";
import { handle, HttpError } from "@/server/http";
import type { MaterialRow } from "@/server/rows";

/**
 * A one-hour download link for an uploaded material. Row-level security decides who may read the
 * material (staff, or students in a batch of the course while its materials are on); the storage
 * policy checks the same thing for the file itself.
 */
export const GET = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext();
  const { data: row } = await ctx.supabase.from("materials").select("*").eq("id", id).maybeSingle<MaterialRow>();
  if (!row) throw new HttpError(404, "This material isn't available to you.");
  if (!row.file_path) return { result: null };
  const { data, error } = await ctx.supabase.storage.from("materials").createSignedUrl(row.file_path, 3600, { download: row.file_name || true });
  if (error || !data) throw new HttpError(404, "The file for this material couldn't be found. Ask the course designer to upload it again.");
  return { result: data.signedUrl };
});
