import { apiContext, PEOPLE } from "@/server/context";
import { check, handle, must, readJson } from "@/server/http";
import { formatDate } from "@/lib/format";
import { dateOrNull, leadResponse, logActivity } from "@/server/people";

/** Set or clear a lead's next follow-up date. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const body = await readJson(req);
  const date = dateOrNull(body.date ?? null, "a valid follow-up date") ?? null;
  must(await sb.from("leads").select("id").eq("id", id).maybeSingle(), { notFound: "That lead no longer exists." });
  check(await sb.from("leads").update({ follow_up_on: date }).eq("id", id));
  await logActivity(sb, id, ctx.profile.name, "follow-up", date ? `Follow-up set for ${formatDate(date)}` : "Follow-up cleared");
  return leadResponse(sb, id);
});
