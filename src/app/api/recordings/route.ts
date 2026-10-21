import { DELIVERY, apiContext } from "@/server/context";
import { hasEnded, lectureRow } from "@/server/delivery";
import { HttpError, fromPg, handle, int, readJson, text } from "@/server/http";
import { loadRecording } from "@/server/loaders";
import type { RecordingRow } from "@/server/rows";

/**
 * Records an uploaded video against a finished lecture. The browser has already put the file in
 * the "recordings" bucket under <batch>/<lecture>/; if anything here fails, that upload is removed.
 */
export const POST = handle(async (req) => {
  const ctx = await apiContext(...DELIVERY);
  const sb = ctx.supabase;
  const body = await readJson(req);
  const filePath = text(body.filePath, "the uploaded file", { required: true, max: 500 }) as string;
  if (typeof body.lectureId !== "string" || !body.lectureId) throw new HttpError(400, "Choose the lecture this recording belongs to.");
  const lectureId = body.lectureId;

  let pathIsOurs = false;
  try {
    const lecture = await lectureRow(sb, lectureId);
    pathIsOurs = filePath.startsWith(`${lecture.batch_id}/${lectureId}/`) && !filePath.includes("..");
    if (!pathIsOurs) throw new HttpError(400, "The upload doesn't match this lecture. Upload the file again.");
    if (lecture.status === "cancelled") throw new HttpError(400, "This lecture was cancelled, so it has no recording.");
    if (!hasEnded(lecture)) throw new HttpError(400, "Upload the recording after the lecture ends.");
    const fileName = text(body.fileName, "the file name", { required: true, max: 200 }) as string;
    const durationMins = int(body.durationMins, "the recording length in minutes", { required: true, min: 1, max: 24 * 60 }) as number;
    const sizeMb = typeof body.sizeMb === "number" && Number.isFinite(body.sizeMb) && body.sizeMb >= 0 ? body.sizeMb : 0;

    const { data: existing } = await sb.from("recordings").select("id").eq("lecture_id", lectureId).maybeSingle<{ id: string }>();
    if (existing) throw new HttpError(409, "This lecture already has a recording. Delete it first to replace it.");
    const { data: settings } = await sb.from("org_settings").select("auto_publish_recordings").eq("id", 1).maybeSingle<{ auto_publish_recordings: boolean }>();

    const now = new Date().toISOString();
    const { data, error } = await sb
      .from("recordings")
      .insert({
        lecture_id: lectureId,
        batch_id: lecture.batch_id,
        title: lecture.title,
        duration_mins: durationMins,
        file_name: fileName,
        file_path: filePath,
        size_mb: sizeMb,
        status: "ready",
        uploaded_at: now,
        ready_at: now,
        uploaded_by: ctx.profile.id,
        published: !!settings?.auto_publish_recordings,
      })
      .select("*")
      .single<RecordingRow>();
    if (error) throw fromPg(error, { unique: "This lecture already has a recording. Delete it first to replace it." });
    const recording = await loadRecording(sb, data.id);
    return { result: recording, patch: { recordings: { upsert: [recording] } } };
  } catch (err) {
    if (pathIsOurs) await sb.storage.from("recordings").remove([filePath]);
    throw err;
  }
});
