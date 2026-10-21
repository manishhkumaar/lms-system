import { apiContext, PEOPLE } from "@/server/context";
import { check, handle, must, oneOf, readJson, requiredText } from "@/server/http";
import { ACTIVITY_KINDS, leadResponse, logActivity } from "@/server/people";

/** Add a note or log a call on a lead. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const body = await readJson(req);
  const textValue = requiredText(body.text, "the note", 2000);
  const kind = oneOf(body.kind, ACTIVITY_KINDS, "a kind of note", false) || "note";
  must(await sb.from("leads").select("id").eq("id", id).maybeSingle(), { notFound: "That lead no longer exists." });
  await logActivity(sb, id, ctx.profile.name, kind, textValue);
  check(await sb.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", id));
  return leadResponse(sb, id);
});
