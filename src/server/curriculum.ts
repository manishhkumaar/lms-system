import "server-only";
/* Shared rules for the course, material and batch API routes. */
import type { ID } from "@/data/types";
import type { ServerClient } from "./context";
import { check, HttpError, must } from "./http";
import type { MaterialRow, ModuleRow } from "./rows";
import { toMaterial } from "./mappers";

export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export const MATERIAL_KINDS = ["notes", "slides", "pdf", "link"] as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Next position at the end of a list (modules of a course, templates of a module). */
export async function nextPosition(sb: ServerClient, table: "course_modules" | "lecture_templates", column: "course_id" | "module_id", value: ID): Promise<number> {
  const rows = must(await sb.from(table).select("position").eq(column, value).order("position", { ascending: false }).limit(1)) as Array<{ position: number }>;
  return rows.length ? rows[0].position + 1 : 0;
}

export async function modulesOf(sb: ServerClient, courseId: ID): Promise<ModuleRow[]> {
  return must(await sb.from("course_modules").select("*").eq("course_id", courseId).order("position")) as ModuleRow[];
}

export async function templateCount(sb: ServerClient, courseId: ID): Promise<number> {
  const mods = await modulesOf(sb, courseId);
  if (!mods.length) return 0;
  const { count, error } = await sb.from("lecture_templates").select("id", { count: "exact", head: true }).in("module_id", mods.map((m) => m.id));
  check({ error });
  return count || 0;
}

/** All of a course's materials, for patches after a module disappears (their module_id is cleared). */
export async function courseMaterials(sb: ServerClient, courseId: ID) {
  return (must(await sb.from("materials").select("*").eq("course_id", courseId)) as MaterialRow[]).map(toMaterial);
}

/** Seats taken in a batch: active and completed enrolments. */
export async function seatsFilled(sb: ServerClient, batchId: ID): Promise<number> {
  const { count, error } = await sb.from("enrolments").select("id", { count: "exact", head: true }).eq("batch_id", batchId).in("status", ["active", "completed"]);
  check({ error });
  return count || 0;
}

/** Days of the week, validated and in week order. */
export function weekdays(v: unknown): Array<(typeof WEEKDAYS)[number]> {
  if (!Array.isArray(v) || !v.length) throw new HttpError(400, "Choose at least one day of the week.");
  if (!v.every((d) => WEEKDAYS.includes(d))) throw new HttpError(400, "Choose valid days of the week.");
  return WEEKDAYS.filter((d) => v.includes(d));
}

export function instructorList(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) throw new HttpError(400, "Enter instructor names as text.");
  const names = v.map((x: string) => x.trim()).filter(Boolean);
  if (names.length > 10) throw new HttpError(400, "List at most 10 instructors.");
  if (names.some((n) => n.length > 80)) throw new HttpError(400, "Keep each instructor's name under 80 characters.");
  return names;
}

/** Removes an uploaded material file; a missing object isn't an error worth surfacing. */
export async function removeMaterialFile(sb: ServerClient, path: string | null | undefined) {
  if (!path) return;
  const { error } = await sb.storage.from("materials").remove([path]);
  if (error) console.warn("Couldn't remove material file", path, error.message);
}
