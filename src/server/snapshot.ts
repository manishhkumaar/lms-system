import "server-only";
/*
 * Builds the client's starting data. Every query runs as the signed-in person, so row-level security
 * decides what's included: staff get the whole organisation, a student gets their own batches only.
 */
import type { DB } from "@/data/types";
import type { ApiContext, ServerClient } from "./context";
import { fromPg } from "./http";
import { toAttendance, toBatch, toCourse, toEnrolment, toInvitedUser, toLead, toLecture, toMaterial, toRecording, toSettings, toStudent, toUser } from "./mappers";
import type {
  ActivityRow,
  AttendanceRow,
  BatchRow,
  CourseRow,
  EnrolmentRow,
  InvitationRow,
  LeadRow,
  LectureRow,
  LinkRow,
  MaterialRow,
  ModuleRow,
  ProfileRow,
  RecordingRow,
  SettingsRow,
  StudentRow,
  TemplateRow,
} from "./rows";

const PAGE = 1000; // PostgREST's default max rows per request

/** Every row the caller may see, fetched in pages. */
export async function selectAll<T>(sb: ServerClient, table: string, order = "id"): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select("*").order(order).range(from, from + PAGE - 1);
    if (error) throw fromPg(error);
    out.push(...((data || []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function buildSnapshot(ctx: ApiContext): Promise<DB> {
  const sb = ctx.supabase;
  const staff = ctx.role !== "student";
  const peopleStaff = ctx.role === "super-admin" || ctx.role === "operations" || ctx.role === "admissions";

  const [profiles, invitations, courses, modules, templates, materials, batches, lectures, links, recordings, students, leads, activity, enrolments, attendance, settingsRows] = await Promise.all([
    selectAll<ProfileRow>(sb, "profiles"),
    ctx.role === "super-admin" || peopleStaff ? selectAll<InvitationRow>(sb, "invitations").then((xs) => xs.filter((i) => !i.accepted_at)) : Promise.resolve([] as InvitationRow[]),
    selectAll<CourseRow>(sb, "courses"),
    selectAll<ModuleRow>(sb, "course_modules"),
    selectAll<TemplateRow>(sb, "lecture_templates"),
    selectAll<MaterialRow>(sb, "materials"),
    selectAll<BatchRow>(sb, "batches"),
    selectAll<LectureRow>(sb, "lectures"),
    selectAll<LinkRow>(sb, "lecture_links", "lecture_id"),
    selectAll<RecordingRow>(sb, "recordings"),
    selectAll<StudentRow>(sb, "students"),
    peopleStaff ? selectAll<LeadRow>(sb, "leads") : Promise.resolve([] as LeadRow[]),
    peopleStaff ? selectAll<ActivityRow>(sb, "lead_activity") : Promise.resolve([] as ActivityRow[]),
    selectAll<EnrolmentRow>(sb, "enrolments"),
    selectAll<AttendanceRow>(sb, "attendance"),
    selectAll<SettingsRow>(sb, "org_settings"),
  ]);

  const settings = toSettings(settingsRows[0]);
  const studentByUser = new Map(students.filter((s) => s.user_id).map((s) => [s.user_id as string, s.id]));
  const linkByLecture = new Map(links.map((l) => [l.lecture_id, l]));
  const activityByLead = new Map<string, ActivityRow[]>();
  for (const a of activity) activityByLead.set(a.lead_id, [...(activityByLead.get(a.lead_id) || []), a]);

  return {
    version: 1,
    meId: ctx.profile.id,
    users: [...profiles.map((p) => toUser(p, studentByUser.get(p.id))), ...(staff ? invitations.map((i) => toInvitedUser(i, settings.defaultTimeZone)) : [])],
    courses: courses.map((c) => toCourse(c, modules, templates)),
    materials: materials.map(toMaterial),
    batches: batches.map(toBatch),
    lectures: lectures.map((l) => toLecture(l, linkByLecture.get(l.id))),
    recordings: recordings.map(toRecording),
    leads: leads.map((l) => toLead(l, activityByLead.get(l.id) || [])),
    students: students.map(toStudent),
    enrolments: enrolments.map(toEnrolment),
    attendance: attendance.map(toAttendance),
    settings,
  };
}
