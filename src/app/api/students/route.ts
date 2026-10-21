import { apiContext, PEOPLE } from "@/server/context";
import { email, handle, must, phone, readJson, requiredText, text } from "@/server/http";
import { enrolResponse, fee } from "@/server/people";

/** Add a student who didn't come through Leads, optionally enrolling them straight away. */
export const POST = handle(async (req) => {
  const ctx = await apiContext(...PEOPLE);
  const body = await readJson(req);
  const batchId = text(body.batchId, "a batch", { max: 64 }) ?? null;
  const out = must(
    await ctx.supabase.rpc("add_student", {
      p_name: requiredText(body.name, "the student's full name", 120),
      p_email: email(body.email),
      p_phone: phone(body.phone),
      p_city: text(body.city, "a city", { max: 80 }) ?? null,
      p_batch_id: batchId,
      p_fee: fee(body.feePaid),
    }),
  ) as { student_id: string; enrolment_id: string | null; token: string | null };
  return enrolResponse(ctx.supabase, out);
});
