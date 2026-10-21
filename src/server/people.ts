import "server-only";
/* Helpers shared by the people routes: leads, students, enrolments, invitations. */
import type { EnrolResult } from "@/data/actions";
import type { ID, LeadActivity, LeadStage, Patch } from "@/data/types";
import type { ServerClient } from "./context";
import { check, HttpError } from "./http";
import { loadEnrolments, loadLead, loadStudent, openStudentInvite } from "./loaders";

export const LEAD_SOURCES = ["Website", "Instagram", "Referral", "Google Ads", "WhatsApp", "Walk-in", "Webinar"] as const;
export const LEAD_STAGES = ["new", "contacted", "interview-scheduled", "interviewed", "selected", "rejected", "enrolled"] as const;
export const ACTIVITY_KINDS = ["note", "call", "stage", "follow-up", "interview", "enrolment"] as const;
export const STAFF_ROLES = ["super-admin", "operations", "course-designer", "admissions"] as const;

export const STAGE_TEXT: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  "interview-scheduled": "Interview scheduled",
  interviewed: "Interviewed",
  selected: "Selected",
  rejected: "Rejected",
  enrolled: "Enrolled",
};

export async function logActivity(sb: ServerClient, leadId: ID, by: string, kind: LeadActivity["kind"], text: string) {
  check(await sb.from("lead_activity").insert({ lead_id: leadId, by_name: by, kind, text }));
}

/** The lead after a write, as { result, patch }. */
export async function leadResponse(sb: ServerClient, id: ID) {
  const lead = await loadLead(sb, id);
  return { result: lead, patch: { leads: { upsert: [lead] } } satisfies Patch };
}

/** Fails with a clear message when the course id doesn't exist. */
export async function assertCourse(sb: ServerClient, courseId: string) {
  const { data } = await sb.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (!data) throw new HttpError(400, "Choose a course that exists.");
}

/** Fails with a clear message when the owner isn't an active staff member. */
export async function ownerName(sb: ServerClient, ownerId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("name, role, status").eq("id", ownerId).maybeSingle<{ name: string; role: string; status: string }>();
  if (!data || data.role === "student" || data.status !== "active") throw new HttpError(400, "Choose an owner from the team.");
  return data.name;
}

/** Builds the EnrolResult and patch after enrol_lead / add_student. */
export async function enrolResponse(sb: ServerClient, out: { student_id: string; enrolment_id: string | null; token: string | null }, leadId?: ID) {
  const student = await loadStudent(sb, out.student_id);
  const enrolments = out.enrolment_id ? await loadEnrolments(sb, [out.enrolment_id]) : [];
  const invite = await openStudentInvite(sb, student.id);
  const patch: Patch = {
    students: { upsert: [student] },
    ...(enrolments.length ? { enrolments: { upsert: enrolments } } : {}),
    ...(invite ? { users: { upsert: [invite] } } : {}),
  };
  if (leadId) patch.leads = { upsert: [await loadLead(sb, leadId)] };
  const result: EnrolResult = { student, enrolment: enrolments[0], activationPath: out.token ? `/activate?token=${out.token}` : undefined };
  return { result, patch };
}

/** An open invitation for this email, or an existing profile. */
export async function emailTaken(sb: ServerClient, email: string): Promise<boolean> {
  const { data: p } = await sb.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (p) return true;
  const { data: i } = await sb.from("invitations").select("id").eq("email", email.toLowerCase()).is("accepted_at", null).maybeSingle();
  return !!i;
}


/** An ISO timestamp from the body: undefined if absent, null to clear. */
export function timestamp(v: unknown, label: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new HttpError(400, `Choose ${label}.`);
  return new Date(v).toISOString();
}

/** A YYYY-MM-DD date from the body: undefined if absent, null to clear. */
export function dateOrNull(v: unknown, label: string): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new HttpError(400, `Choose ${label}.`);
  return v;
}

/** Fee paid in rupees: a whole number, 0 or more. */
export function fee(v: unknown): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, "Enter the fee paid in rupees, or 0.");
  return Math.round(n);
}
