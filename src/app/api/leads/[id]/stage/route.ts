import { apiContext, PEOPLE } from "@/server/context";
import { check, handle, HttpError, must, oneOf, readJson, text } from "@/server/http";
import { LEAD_STAGES, leadResponse, logActivity, STAGE_TEXT, timestamp } from "@/server/people";
import type { LeadRow } from "@/server/rows";

/**
 * Moves a lead along the pipeline. Interview scheduled needs interviewAt; Enrolled goes through
 * /enrol because it needs a batch.
 */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const body = await readJson(req);
  const stage = oneOf(body.stage, LEAD_STAGES, "a stage")!;
  if (stage === "enrolled") throw new HttpError(400, "Use Enrol student to enrol a lead into a batch.");
  const lead = must(await sb.from("leads").select("*").eq("id", id).maybeSingle<LeadRow>(), { notFound: "That lead no longer exists." });
  if (lead.stage === "enrolled") throw new HttpError(400, `${lead.name} is already enrolled. Manage their batch from their student profile.`);
  const interviewAt = timestamp(body.interviewAt, "the interview date and time");
  if (stage === "interview-scheduled" && !interviewAt) throw new HttpError(400, "Choose the interview date and time.");
  const reason = text(body.reason, "a reason", { max: 300 });
  const note = text(body.note, "a note", { max: 2000 });
  check(
    await sb
      .from("leads")
      .update({
        stage,
        interview_at: stage === "interview-scheduled" ? interviewAt : lead.interview_at,
        rejection_reason: stage === "rejected" ? (reason ?? null) : null,
      })
      .eq("id", id),
  );
  await logActivity(sb, id, ctx.profile.name, "stage", `Moved to ${STAGE_TEXT[stage]}${reason ? `: ${reason}` : ""}`);
  if (note) await logActivity(sb, id, ctx.profile.name, "note", note);
  return leadResponse(sb, id);
});
