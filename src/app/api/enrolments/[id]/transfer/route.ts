import { apiContext, PEOPLE } from "@/server/context";
import { handle, HttpError, must, readJson, text } from "@/server/http";
import { loadEnrolments } from "@/server/loaders";

/** Moves an active enrolment to another batch. Attendance history stays with the old batch. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const body = await readJson(req);
  const toBatchId = text(body.toBatchId, "a batch", { max: 64 });
  if (!toBatchId) throw new HttpError(400, "Choose the batch to move to.");
  const out = must(await ctx.supabase.rpc("transfer_student", { p_enrolment_id: id, p_to_batch_id: toBatchId })) as { enrolment_id: string; from_enrolment_id: string };
  const rows = await loadEnrolments(ctx.supabase, [out.enrolment_id, out.from_enrolment_id]);
  return { result: rows.find((e) => e.id === out.enrolment_id), patch: { enrolments: { upsert: rows } } };
});
