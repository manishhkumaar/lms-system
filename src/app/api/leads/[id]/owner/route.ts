import { apiContext, PEOPLE } from "@/server/context";
import { check, handle, must, readJson, text } from "@/server/http";
import { leadResponse, logActivity, ownerName } from "@/server/people";

/** Assign a lead to an Admissions Executive, or unassign it. */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const body = await readJson(req);
  const ownerId = text(body.ownerId, "an owner", { max: 64 }) ?? null;
  const name = ownerId ? await ownerName(sb, ownerId) : null;
  must(await sb.from("leads").select("id").eq("id", id).maybeSingle(), { notFound: "That lead no longer exists." });
  check(await sb.from("leads").update({ owner_id: ownerId }).eq("id", id));
  await logActivity(sb, id, ctx.profile.name, "note", name ? `Assigned to ${name}` : "Unassigned");
  return leadResponse(sb, id);
});
