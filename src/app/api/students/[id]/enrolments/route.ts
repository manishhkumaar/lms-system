import { apiContext, PEOPLE } from "@/server/context";
import { handle, HttpError, must, readJson, text } from "@/server/http";
import { loadEnrolments } from "@/server/loaders";
import { fee } from "@/server/people";

/** Enrol an existing student in another batch (seat-checked in Postgres). */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const body = await readJson(req);
  const batchId = text(body.batchId, "a batch", { max: 64 });
  if (!batchId) throw new HttpError(400, "Choose a batch with seats left.");
  const out = must(await ctx.supabase.rpc("enrol_student", { p_student_id: id, p_batch_id: batchId, p_fee: fee(body.feePaid) })) as { enrolment_id: string };
  const [enrolment] = await loadEnrolments(ctx.supabase, [out.enrolment_id]);
  return { result: enrolment, patch: { enrolments: { upsert: [enrolment] } } };
});
