import { apiContext, PEOPLE } from "@/server/context";
import { check, defined, email, handle, must, phone, readJson, text } from "@/server/http";
import { loadStudent } from "@/server/loaders";

/** Edit a student's contact details. */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...PEOPLE);
  const sb = ctx.supabase;
  const body = await readJson(req);
  must(await sb.from("students").select("id").eq("id", id).maybeSingle(), { notFound: "That student no longer exists." });
  const row = defined({
    name: text(body.name, "the student's full name", { max: 120 }),
    email: body.email === undefined ? undefined : email(body.email),
    phone: body.phone === undefined ? undefined : phone(body.phone),
    city: body.city === undefined ? undefined : (text(body.city, "a city", { max: 80 }) ?? null),
  });
  if (Object.keys(row).length) check(await sb.from("students").update(row).eq("id", id), { unique: "Another student already uses this email." });
  const student = await loadStudent(sb, id);
  return { result: student, patch: { students: { upsert: [student] } } };
});
