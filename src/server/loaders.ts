import "server-only";
/*
 * Read one record back as a domain object after a write, to send in the response patch.
 * All reads go through the caller's client, so row-level security still applies.
 */
import type { Course, Enrolment, ID, Lead, Lecture, Material, Patch, Recording, Student, User } from "@/data/types";
import type { ServerClient } from "./context";
import { must } from "./http";
import { toAttendance, toBatch, toCourse, toEnrolment, toInvitedUser, toLead, toLecture, toMaterial, toRecording, toStudent, toUser } from "./mappers";
import type { ActivityRow, AttendanceRow, BatchRow, CourseRow, EnrolmentRow, InvitationRow, LeadRow, LectureRow, LinkRow, MaterialRow, ModuleRow, ProfileRow, RecordingRow, StudentRow, TemplateRow } from "./rows";

export async function loadCourse(sb: ServerClient, id: ID): Promise<Course> {
  const course = must(await sb.from("courses").select("*").eq("id", id).maybeSingle<CourseRow>(), { notFound: "That course no longer exists." });
  const modules = must(await sb.from("course_modules").select("*").eq("course_id", id)) as ModuleRow[];
  const templates = modules.length ? (must(await sb.from("lecture_templates").select("*").in("module_id", modules.map((m) => m.id))) as TemplateRow[]) : [];
  return toCourse(course, modules, templates);
}

/** The course that owns a module (for permission-free lookups after module/template writes). */
export async function courseIdOfModule(sb: ServerClient, moduleId: ID): Promise<ID> {
  const row = must(await sb.from("course_modules").select("course_id").eq("id", moduleId).maybeSingle<{ course_id: string }>(), { notFound: "That module no longer exists." });
  return row.course_id;
}

export async function courseIdOfTemplate(sb: ServerClient, templateId: ID): Promise<ID> {
  const row = must(await sb.from("lecture_templates").select("module_id").eq("id", templateId).maybeSingle<{ module_id: string }>(), { notFound: "That lecture template no longer exists." });
  return courseIdOfModule(sb, row.module_id);
}

/** Touches the course's updated_at and returns a patch with the whole course. */
export async function coursePatch(sb: ServerClient, courseId: ID): Promise<{ course: Course; patch: Patch }> {
  await sb.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", courseId);
  const course = await loadCourse(sb, courseId);
  return { course, patch: { courses: { upsert: [course] } } };
}

export async function loadMaterial(sb: ServerClient, id: ID): Promise<Material> {
  return toMaterial(must(await sb.from("materials").select("*").eq("id", id).maybeSingle<MaterialRow>(), { notFound: "That material no longer exists." }));
}

export async function loadBatch(sb: ServerClient, id: ID) {
  return toBatch(must(await sb.from("batches").select("*").eq("id", id).maybeSingle<BatchRow>(), { notFound: "That batch no longer exists." }));
}

export async function loadLecture(sb: ServerClient, id: ID): Promise<Lecture> {
  const l = must(await sb.from("lectures").select("*").eq("id", id).maybeSingle<LectureRow>(), { notFound: "That lecture no longer exists." });
  const { data: link } = await sb.from("lecture_links").select("*").eq("lecture_id", id).maybeSingle<LinkRow>();
  return toLecture(l, link || undefined);
}

export async function loadLectures(sb: ServerClient, ids: ID[]): Promise<Lecture[]> {
  if (!ids.length) return [];
  const rows = must(await sb.from("lectures").select("*").in("id", ids)) as LectureRow[];
  const links = must(await sb.from("lecture_links").select("*").in("lecture_id", ids)) as LinkRow[];
  const byId = new Map(links.map((k) => [k.lecture_id, k]));
  return rows.map((r) => toLecture(r, byId.get(r.id)));
}

export async function loadRecording(sb: ServerClient, id: ID): Promise<Recording> {
  return toRecording(must(await sb.from("recordings").select("*").eq("id", id).maybeSingle<RecordingRow>(), { notFound: "That recording no longer exists." }));
}

export async function loadLead(sb: ServerClient, id: ID): Promise<Lead> {
  const lead = must(await sb.from("leads").select("*").eq("id", id).maybeSingle<LeadRow>(), { notFound: "That lead no longer exists." });
  const activity = must(await sb.from("lead_activity").select("*").eq("lead_id", id)) as ActivityRow[];
  return toLead(lead, activity);
}

export async function loadStudent(sb: ServerClient, id: ID): Promise<Student> {
  return toStudent(must(await sb.from("students").select("*").eq("id", id).maybeSingle<StudentRow>(), { notFound: "That student no longer exists." }));
}

export async function loadEnrolments(sb: ServerClient, ids: ID[]): Promise<Enrolment[]> {
  if (!ids.length) return [];
  return (must(await sb.from("enrolments").select("*").in("id", ids)) as EnrolmentRow[]).map(toEnrolment);
}

export async function loadAttendance(sb: ServerClient, lectureId: ID) {
  return (must(await sb.from("attendance").select("*").eq("lecture_id", lectureId)) as AttendanceRow[]).map(toAttendance);
}

/** A profile as a User (with its linked student id, if any). */
export async function loadUser(sb: ServerClient, id: ID): Promise<User> {
  const p = must(await sb.from("profiles").select("*").eq("id", id).maybeSingle<ProfileRow>(), { notFound: "That person no longer exists." });
  const { data: s } = await sb.from("students").select("id").eq("user_id", id).maybeSingle<{ id: string }>();
  return toUser(p, s?.id);
}

export async function loadInvitedUser(sb: ServerClient, id: ID): Promise<User> {
  const i = must(await sb.from("invitations").select("*").eq("id", id).maybeSingle<InvitationRow>(), { notFound: "That invitation no longer exists." });
  const { data: s } = await sb.from("org_settings").select("default_time_zone").eq("id", 1).maybeSingle<{ default_time_zone: string }>();
  return toInvitedUser(i, s?.default_time_zone || "Asia/Kolkata");
}

/** The current invitation (as an invited user) for a student, if they have one open. */
export async function openStudentInvite(sb: ServerClient, studentId: ID): Promise<User | undefined> {
  const { data } = await sb.from("invitations").select("id").eq("student_id", studentId).is("accepted_at", null).maybeSingle<{ id: string }>();
  return data ? loadInvitedUser(sb, data.id) : undefined;
}
