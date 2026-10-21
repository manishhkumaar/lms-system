import type { Patch } from "@/data/types";
import { apiContext, PEOPLE } from "@/server/context";
import { handle, must } from "@/server/http";
import { openStudentInvite } from "@/server/loaders";

/** Creates or re-issues a student's account invite. Resolves with the activation path. */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const before = await openStudentInvite(ctx.supabase, id);
  const token = must(await ctx.supabase.rpc("invite_student", { p_student_id: id })) as string;
  const invite = await openStudentInvite(ctx.supabase, id);
  const patch: Patch = { users: { remove: before && before.id !== invite?.id ? [before.id] : [], upsert: invite ? [invite] : [] } };
  return { result: `/activate?token=${token}`, patch };
});
