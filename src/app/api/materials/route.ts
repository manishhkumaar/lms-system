import { apiContext, CURRICULUM } from "@/server/context";
import { MATERIAL_KINDS, removeMaterialFile } from "@/server/curriculum";
import { handle, HttpError, int, must, oneOf, readJson, requiredText, text } from "@/server/http";
import { loadCourse } from "@/server/loaders";
import { toMaterial } from "@/server/mappers";
import type { MaterialRow } from "@/server/rows";

/**
 * Add notes, a link, or slides/PDF to a course. Files are uploaded by the browser to the
 * "materials" bucket under the course's folder first; this records them.
 */
export const POST = handle(async (req) => {
  const ctx = await apiContext(...CURRICULUM);
  const body = await readJson(req);
  const courseId = requiredText(body.courseId, "the course", 64);
  const course = await loadCourse(ctx.supabase, courseId);
  const moduleId = text(body.moduleId, "the module", { max: 64 });
  if (moduleId && !course.modules.some((m) => m.id === moduleId)) throw new HttpError(400, "Choose a module from this course.");
  const kind = oneOf(body.kind, MATERIAL_KINDS, "the kind of material")!;
  const row: Omit<MaterialRow, "id" | "updated_at"> = {
    course_id: courseId,
    module_id: moduleId || null,
    title: requiredText(body.title, "a title students will recognise", 160),
    kind,
    body: null,
    url: null,
    file_name: null,
    file_path: null,
    size_kb: null,
  };
  if (kind === "notes") row.body = requiredText(body.body, "the notes", 50000);
  if (kind === "link") {
    row.url = requiredText(body.url, "the link", 2000);
    if (!/^https:\/\/\S+\.\S+/.test(row.url)) throw new HttpError(400, "Enter a full link starting with https://");
  }
  if (kind === "slides" || kind === "pdf") {
    const filePath = requiredText(body.filePath, "the file to upload", 500);
    if (!filePath.startsWith(`${courseId}/`)) throw new HttpError(400, "Upload the file again from this course.");
    row.file_path = filePath;
    row.file_name = text(body.fileName, "the file name", { max: 255 }) || filePath.split("/").pop() || null;
    row.size_kb = int(body.sizeKb, "the file size", { min: 0 }) ?? null;
  }
  const res = await ctx.supabase.from("materials").insert(row).select("*").single<MaterialRow>();
  if (res.error && row.file_path) await removeMaterialFile(ctx.supabase, row.file_path);
  const material = toMaterial(must(res));
  return { result: material, patch: { materials: { upsert: [material] } } };
});
