import { apiContext, PEOPLE } from "@/server/context";
import { check, handle, HttpError, must } from "@/server/http";
import { loadEnrolments } from "@/server/loaders";
import type { EnrolmentRow } from "@/server/rows";

/** Removes a student from a batch. Their attendance history is kept. */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const e = must(await sb.from("enrolments").select("*").eq("id", id).maybeSingle<EnrolmentRow>(), { notFound: "That enrolment no longer exists." });
  if (e.status !== "active") throw new HttpError(400, "Only an active enrolment can be removed.");
  check(await sb.from("enrolments").update({ status: "dropped" }).eq("id", id));
  const [enrolment] = await loadEnrolments(sb, [id]);
  return { result: enrolment, patch: { enrolments: { upsert: [enrolment] } } };
});
