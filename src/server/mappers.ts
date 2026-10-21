/* Postgres rows → the app's domain types (src/data/types.ts). */
import type { Attendance, Batch, Course, Enrolment, Lead, LeadSource, LeadStage, Lecture, Material, OrgSettings, Recording, Student, User } from "@/data/types";
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

const opt = <T,>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

export function toUser(p: ProfileRow, studentId?: string): User {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: opt(p.phone),
    role: p.role,
    status: p.status,
    timeZone: p.time_zone,
    studentId,
    createdAt: p.created_at,
    lastActiveAt: opt(p.last_active_at),
  };
}

/** An open invitation shows as an "invited" user until it's accepted. */
export function toInvitedUser(i: InvitationRow, defaultTimeZone: string): User {
  return {
    id: i.id,
    name: i.name,
    email: i.email,
    role: i.role,
    status: "invited",
    activationToken: i.token,
    timeZone: defaultTimeZone,
    studentId: opt(i.student_id),
    createdAt: i.created_at,
  };
}

export function toCourse(c: CourseRow, modules: ModuleRow[], templates: TemplateRow[]): Course {
  const mods = modules.filter((m) => m.course_id === c.id).sort((a, b) => a.position - b.position);
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    summary: c.summary,
    level: c.level,
    durationWeeks: c.duration_weeks,
    fee: c.fee,
    status: c.status,
    materialsEnabled: c.materials_enabled,
    designerId: c.designer_id || "",
    updatedAt: c.updated_at,
    modules: mods.map((m) => ({
      id: m.id,
      title: m.title,
      lectures: templates
        .filter((t) => t.module_id === m.id)
        .sort((a, b) => a.position - b.position)
        .map((t) => ({ id: t.id, title: t.title, durationMins: t.duration_mins, summary: opt(t.summary) })),
    })),
  };
}

export function toMaterial(m: MaterialRow): Material {
  return {
    id: m.id,
    courseId: m.course_id,
    moduleId: opt(m.module_id),
    title: m.title,
    kind: m.kind,
    body: opt(m.body),
    url: opt(m.url),
    fileName: opt(m.file_name),
    filePath: opt(m.file_path),
    sizeKb: opt(m.size_kb),
    updatedAt: m.updated_at,
  };
}

export function toBatch(b: BatchRow): Batch {
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    courseId: b.course_id,
    startDate: b.start_date,
    endDate: b.end_date,
    capacity: b.capacity,
    instructors: b.instructors || [],
    timeZone: b.time_zone,
    days: (b.days || []) as Batch["days"],
    slotStart: b.slot_start,
    slotEnd: b.slot_end,
    lifecycle: b.lifecycle,
    ownerId: opt(b.owner_id),
    createdAt: b.created_at,
  };
}

/** The link row is absent for a student until it's published. */
export function toLecture(l: LectureRow, link?: LinkRow): Lecture {
  return {
    id: l.id,
    batchId: l.batch_id,
    number: l.number,
    title: l.title,
    start: l.start_at,
    end: l.end_at,
    timeZone: l.time_zone,
    instructor: opt(l.instructor),
    meetingUrl: link?.meeting_url,
    linkPublished: !!link?.published,
    status: l.status,
    previousStart: opt(l.previous_start),
    agenda: opt(l.agenda),
  };
}

export function toRecording(r: RecordingRow): Recording {
  return {
    id: r.id,
    lectureId: r.lecture_id,
    batchId: r.batch_id,
    title: r.title,
    durationMins: r.duration_mins,
    fileName: r.file_name,
    filePath: opt(r.file_path),
    sizeMb: Number(r.size_mb),
    status: r.status,
    uploadedAt: r.uploaded_at,
    readyAt: r.ready_at,
    uploadedBy: r.uploaded_by || "",
    published: r.published,
    views: r.views,
  };
}

export function toStudent(s: StudentRow): Student {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    city: opt(s.city),
    leadId: opt(s.lead_id),
    userId: opt(s.user_id),
    createdAt: s.created_at,
  };
}

export function toLead(l: LeadRow, activity: ActivityRow[]): Lead {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    city: opt(l.city),
    courseId: l.course_id,
    source: l.source as LeadSource,
    stage: l.stage as LeadStage,
    ownerId: opt(l.owner_id),
    interviewAt: opt(l.interview_at),
    followUpOn: opt(l.follow_up_on),
    createdAt: l.created_at,
    updatedAt: l.updated_at,
    studentId: opt(l.student_id),
    batchId: opt(l.batch_id),
    rejectionReason: opt(l.rejection_reason),
    activity: activity
      .filter((a) => a.lead_id === l.id)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((a) => ({ id: a.id, at: a.at, by: a.by_name, kind: a.kind, text: a.text })),
  };
}

export function toEnrolment(e: EnrolmentRow): Enrolment {
  return {
    id: e.id,
    studentId: e.student_id,
    batchId: e.batch_id,
    enrolledAt: e.enrolled_at,
    status: e.status,
    feePaid: e.fee_paid,
    transferredTo: opt(e.transferred_to),
  };
}

export function toAttendance(a: AttendanceRow): Attendance {
  return {
    id: a.id,
    lectureId: a.lecture_id,
    studentId: a.student_id,
    joinedAt: opt(a.joined_at),
    verification: a.verification,
    verifiedBy: opt(a.verified_by),
    verifiedAt: opt(a.verified_at),
  };
}

export function toSettings(s: SettingsRow): OrgSettings {
  return {
    orgName: s.org_name,
    defaultTimeZone: s.default_time_zone,
    joinOpensMinutesBefore: s.join_opens_minutes_before,
    autoPublishRecordings: s.auto_publish_recordings,
    linkReminderHours: s.link_reminder_hours,
    supportEmail: s.support_email,
  };
}
