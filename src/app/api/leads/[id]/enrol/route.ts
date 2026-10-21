import { apiContext, PEOPLE } from "@/server/context";
import { handle, HttpError, must, readJson, text } from "@/server/http";
import { enrolResponse, fee } from "@/server/people";

/** Selected lead → student enrolled in a batch (seat-checked in Postgres), with an account invite. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const body = await readJson(req);
  const batchId = text(body.batchId, "a batch", { max: 64 });
  if (!batchId) throw new HttpError(400, "Choose a batch with seats left.");
  const out = must(await ctx.supabase.rpc("enrol_lead", { p_lead_id: id, p_batch_id: batchId, p_fee: fee(body.feePaid) })) as {
    student_id: string;
    enrolment_id: string | null;
    token: string | null;
  };
  return enrolResponse(ctx.supabase, out, id);
});
