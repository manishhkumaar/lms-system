import { apiContext, CURRICULUM } from "@/server/context";
import { MATERIAL_KINDS, removeMaterialFile } from "@/server/curriculum";
import { check, handle, HttpError, int, must, oneOf, readJson, text } from "@/server/http";
import { loadCourse } from "@/server/loaders";
import { toMaterial } from "@/server/mappers";
import type { MaterialRow } from "@/server/rows";

async function current(ctx: Awaited<ReturnType<typeof apiContext>>, id: string) {
  return must(await ctx.supabase.from("materials").select("*").eq("id", id).maybeSingle<MaterialRow>(), { notFound: "That material no longer exists." });
}

/** Edit a material. A new filePath replaces the uploaded file; changing to notes or a link drops it. */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  const before = await current(ctx, id);
  const courseId = text(body.courseId, "the course", { max: 64 }) || before.course_id;
  const course = await loadCourse(ctx.supabase, courseId);
  const kind = oneOf(body.kind, MATERIAL_KINDS, "the kind of material", false) || before.kind;
  const next: Partial<MaterialRow> = { course_id: courseId, kind, updated_at: new Date().toISOString() };

  if (body.moduleId !== undefined || courseId !== before.course_id) {
    const moduleId = text(body.moduleId, "the module", { max: 64 }) || null;
    if (moduleId && !course.modules.some((m) => m.id === moduleId)) throw new HttpError(400, "Choose a module from this course.");
    next.module_id = moduleId;
  }
  if (body.title !== undefined) {
    const title = text(body.title, "a title", { max: 160 });
    if (!title) throw new HttpError(400, "Enter a title students will recognise.");
    next.title = title;
  }

  let dropFile: string | null = null;
  if (kind === "notes") {
    const notes = body.body === undefined ? before.body : text(body.body, "the notes", { max: 50000 });
    if (!notes) throw new HttpError(400, "Write the notes, or choose another kind.");
    Object.assign(next, { body: notes, url: null, file_name: null, file_path: null, size_kb: null });
    dropFile = before.file_path;
  } else if (kind === "link") {
    const url = body.url === undefined ? before.url : text(body.url, "the link", { max: 2000 });
    if (!url || !/^https:\/\/\S+\.\S+/.test(url)) throw new HttpError(400, "Enter a full link starting with https://");
    Object.assign(next, { url, body: null, file_name: null, file_path: null, size_kb: null });
    dropFile = before.file_path;
  } else {
    const filePath = text(body.filePath, "the file", { max: 500 });
    if (filePath) {
      if (!filePath.startsWith(`${courseId}/`)) throw new HttpError(400, "Upload the file again from this course.");
      Object.assign(next, { file_path: filePath, file_name: text(body.fileName, "the file name", { max: 255 }) || filePath.split("/").pop(), size_kb: int(body.sizeKb, "the file size", { min: 0 }) ?? null });
      if (before.file_path !== filePath) dropFile = before.file_path;
    } else if (!before.file_name) {
      throw new HttpError(400, "Choose the file to upload.");
    }
    Object.assign(next, { body: null, url: null });
  }

  const saved = must(await ctx.supabase.from("materials").update(next).eq("id", id).select("*").single<MaterialRow>());
  if (dropFile) await removeMaterialFile(ctx.supabase, dropFile);
  const material = toMaterial(saved);
  return { result: material, patch: { materials: { upsert: [material] } } };
});

/** Remove a material and its uploaded file. */
export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const ctx = await apiContext(...CURRICULUM);
  const before = await current(ctx, id);
  check(await ctx.supabase.from("materials").delete().eq("id", id));
  await removeMaterialFile(ctx.supabase, before.file_path);
  return { patch: { materials: { remove: [id] } } };
});
