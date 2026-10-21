"use client";
/*
 * Every write the app makes, as calls to its API routes (src/app/api). Each route checks the
 * caller's role, writes through Postgres (row-level security and SQL functions enforce the rules)
 * and returns a patch that ./api applies to the store, so screens update without a refetch.
 */
import { createClient } from "@/utils/supabase/client";
import { ActionError, api } from "./api";
import type { Attendance, Batch, Course, Enrolment, ID, Lead, LeadActivity, LeadSource, LeadStage, Lecture, LectureTemplate, Material, Module, OrgSettings, Recording, Role, Student, User } from "./types";

export { ActionError };
export { isValidMeetingUrl, sessionDates } from "@/lib/schedule";

const enc = encodeURIComponent;

/* =========================== Leads =========================== */

export interface NewLead {
  name: string;
  email: string;
  phone: string;
  city?: string;
  courseId: ID;
  source: LeadSource;
  ownerId?: ID;
  stage?: LeadStage;
  followUpOn?: string;
  note?: string;
}

export const addLead = (input: NewLead) => api<Lead>("POST", "/api/leads", input);

export const updateLead = (id: ID, patch: Partial<Omit<Lead, "id" | "activity">>) => api<Lead>("PATCH", `/api/leads/${enc(id)}`, patch);

/**
 * Moves a lead along the pipeline. Interview scheduled needs interviewAt; Enrolled goes through
 * enrolLead() because it needs a batch.
 */
export const moveLead = (id: ID, stage: LeadStage, opts: { interviewAt?: string; reason?: string; note?: string } = {}) =>
  api<Lead>("POST", `/api/leads/${enc(id)}/stage`, { stage, ...opts });

export const addLeadNote = (id: ID, text: string, kind: LeadActivity["kind"] = "note") => api<Lead>("POST", `/api/leads/${enc(id)}/activity`, { text, kind });

export const setFollowUp = (id: ID, date: string | undefined) => api<Lead>("POST", `/api/leads/${enc(id)}/follow-up`, { date: date || null });

export const assignLead = (id: ID, ownerId: ID | undefined) => api<Lead>("POST", `/api/leads/${enc(id)}/owner`, { ownerId: ownerId || null });

export const deleteLead = (id: ID) => api<void>("DELETE", `/api/leads/${enc(id)}`);

/* ======================= Students & enrolment ======================= */

export interface NewStudent {
  name: string;
  email: string;
  phone: string;
  city?: string;
  leadId?: ID;
}

export interface EnrolResult {
  student: Student;
  enrolment?: Enrolment;
  /** Path for first-time account activation, when the student has no account yet. */
  activationPath?: string;
}

/** Selected lead → student enrolled in a batch. Creates the student and an account invite. */
export const enrolLead = (leadId: ID, batchId: ID, feePaid: number) => api<EnrolResult>("POST", `/api/leads/${enc(leadId)}/enrol`, { batchId, feePaid });

/** Adds a student directly (walk-in) and optionally enrols them. */
export const addStudent = (input: NewStudent, enrol?: { batchId: ID; feePaid: number }) => api<EnrolResult>("POST", "/api/students", { ...input, ...enrol });

export const enrolStudent = (studentId: ID, batchId: ID, feePaid: number) => api<Enrolment>("POST", `/api/students/${enc(studentId)}/enrolments`, { batchId, feePaid });

/** Moves an active enrolment to another batch. Attendance history stays with the old batch. */
export const transferStudent = (enrolmentId: ID, toBatchId: ID) => api<Enrolment>("POST", `/api/enrolments/${enc(enrolmentId)}/transfer`, { toBatchId });

export const dropEnrolment = (enrolmentId: ID) => api<Enrolment>("POST", `/api/enrolments/${enc(enrolmentId)}/drop`);

export const updateStudent = (id: ID, patch: Partial<Pick<Student, "name" | "email" | "phone" | "city">>) => api<Student>("PATCH", `/api/students/${enc(id)}`, patch);

/** Creates (or re-issues) a student's account invite. Resolves with the activation path. */
export const inviteStudent = (studentId: ID) => api<string>("POST", `/api/students/${enc(studentId)}/invite`);

/* =========================== Courses =========================== */

export interface NewCourse {
  code: string;
  title: string;
  summary: string;
  level: Course["level"];
  durationWeeks: number;
  fee: number;
  materialsEnabled?: boolean;
}

export const createCourse = (input: NewCourse) => api<Course>("POST", "/api/courses", input);

export const updateCourse = (id: ID, patch: Partial<Omit<Course, "id" | "modules" | "code" | "designerId" | "updatedAt">>) => api<Course>("PATCH", `/api/courses/${enc(id)}`, patch);

export const setMaterialsEnabled = (courseId: ID, on: boolean) => updateCourse(courseId, { materialsEnabled: on });

export const addModule = (courseId: ID, title: string) => api<Module>("POST", `/api/courses/${enc(courseId)}/modules`, { title });

export const renameModule = (_courseId: ID, moduleId: ID, title: string) => api<Module>("PATCH", `/api/modules/${enc(moduleId)}`, { title });

export const removeModule = (_courseId: ID, moduleId: ID) => api<void>("DELETE", `/api/modules/${enc(moduleId)}`);

export const moveModule = (_courseId: ID, moduleId: ID, dir: -1 | 1) => api<void>("POST", `/api/modules/${enc(moduleId)}/move`, { dir });

export const addLectureTemplate = (_courseId: ID, moduleId: ID, t: Omit<LectureTemplate, "id">) => api<LectureTemplate>("POST", `/api/modules/${enc(moduleId)}/templates`, t);

export const updateLectureTemplate = (_courseId: ID, _moduleId: ID, templateId: ID, patch: Partial<Omit<LectureTemplate, "id">>) =>
  api<LectureTemplate>("PATCH", `/api/templates/${enc(templateId)}`, patch);

export const removeLectureTemplate = (_courseId: ID, _moduleId: ID, templateId: ID) => api<void>("DELETE", `/api/templates/${enc(templateId)}`);

/* ========================== Materials ========================== */

function safeName(name: string) {
  return name.replace(/[^\w.-]+/g, "-").slice(-80);
}

/** Uploads a file to a storage bucket with the signed-in person's session. Resolves with its path. */
async function uploadFile(bucket: "materials" | "recordings", folder: string, file: File): Promise<string> {
  const path = `${folder}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await createClient().storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new ActionError(`Upload failed: ${error.message}`);
  return path;
}

/** Adds a material. For slides and PDFs, pass the file to upload it. */
export async function addMaterial(input: Omit<Material, "id" | "updatedAt" | "filePath">, file?: File): Promise<Material> {
  const filePath = file ? await uploadFile("materials", input.courseId, file) : undefined;
  return api<Material>("POST", "/api/materials", { ...input, filePath, fileName: file?.name ?? input.fileName, sizeKb: file ? Math.ceil(file.size / 1024) : input.sizeKb });
}

export async function updateMaterial(id: ID, patch: Partial<Omit<Material, "id" | "filePath">>, file?: File): Promise<Material> {
  const courseId = patch.courseId;
  const filePath = file ? await uploadFile("materials", courseId || "shared", file) : undefined;
  return api<Material>("PATCH", `/api/materials/${enc(id)}`, file ? { ...patch, filePath, fileName: file.name, sizeKb: Math.ceil(file.size / 1024) } : patch);
}

export const removeMaterial = (id: ID) => api<void>("DELETE", `/api/materials/${enc(id)}`);

/** A short-lived download link for an uploaded material, or null when it has no file. */
export const materialFileUrl = (id: ID) => api<string | null>("GET", `/api/materials/${enc(id)}/url`);

/* =========================== Batches =========================== */

export interface NewBatch {
  courseId: ID;
  /** Two-digit batch number, e.g. "08" */
  number: string;
  startDate: string;
  capacity: number;
  instructors: string[];
  timeZone: string;
  days: Batch["days"];
  slotStart: string;
  slotEnd: string;
  /** Create a lecture for each course lecture template on the batch's days. */
  generateLectures?: boolean;
  /** Save as draft instead of opening for enrolment. */
  draft?: boolean;
}

export const createBatch = (input: NewBatch) => api<Batch>("POST", "/api/batches", input);

export const updateBatch = (id: ID, patch: Partial<Omit<Batch, "id" | "code" | "courseId" | "createdAt">>) => api<Batch>("PATCH", `/api/batches/${enc(id)}`, patch);

export const openBatchForEnrolment = (id: ID) => updateBatch(id, { lifecycle: "active" });

/** Cancels the batch and its upcoming lectures. */
export const cancelBatch = (id: ID) => api<Batch>("POST", `/api/batches/${enc(id)}/cancel`);

/* =========================== Lectures =========================== */

export interface ScheduleInput {
  batchId: ID;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  meetingUrl?: string;
  /** Publish the link now (students can Join once it's live). */
  publish?: boolean;
  instructor?: string;
  agenda?: string;
}

export const scheduleLecture = (input: ScheduleInput) => api<Lecture>("POST", "/api/lectures", input);

/** Moves a lecture. The meeting link moves with it. */
export const rescheduleLecture = (id: ID, when: { date: string; startTime: string; endTime: string; timeZone: string }) => api<Lecture>("POST", `/api/lectures/${enc(id)}/reschedule`, when);

export const updateLecture = (id: ID, patch: Partial<Pick<Lecture, "title" | "instructor" | "agenda">>) => api<Lecture>("PATCH", `/api/lectures/${enc(id)}`, patch);

export const publishLink = (id: ID, url: string) => api<Lecture>("PUT", `/api/lectures/${enc(id)}/link`, { url });

export const unpublishLink = (id: ID) => api<Lecture>("DELETE", `/api/lectures/${enc(id)}/link`);

export const cancelLecture = (id: ID) => api<Lecture>("POST", `/api/lectures/${enc(id)}/cancel`);

/* ========================== Recordings ========================== */

/** Uploads the video to storage, then records it against the finished lecture. */
export async function uploadRecording(input: { lectureId: ID; batchId: ID; file: File; durationMins: number }): Promise<Recording> {
  const filePath = await uploadFile("recordings", `${input.batchId}/${input.lectureId}`, input.file);
  return api<Recording>("POST", "/api/recordings", {
    lectureId: input.lectureId,
    filePath,
    fileName: input.file.name,
    sizeMb: Math.max(1, Math.round(input.file.size / 1048576)),
    durationMins: input.durationMins,
  });
}

export const setRecordingPublished = (id: ID, published: boolean) => api<Recording>("PATCH", `/api/recordings/${enc(id)}`, { published });

export const deleteRecording = (id: ID) => api<void>("DELETE", `/api/recordings/${enc(id)}`);

export const recordView = (id: ID) => api<void>("POST", `/api/recordings/${enc(id)}/view`);

/** A short-lived streaming link for a recording's video, or null for recordings without a file. */
export const recordingUrl = (id: ID) => api<string | null>("GET", `/api/recordings/${enc(id)}/url`);

/* ========================== Attendance ========================== */

/** The signed-in student's Join click. Records "joined", which is not attendance. */
export const recordJoin = (lectureId: ID, _studentId?: ID) => api<Attendance>("POST", `/api/lectures/${enc(lectureId)}/join`);

/** Operations confirms or corrects attendance for one student. */
export const verifyAttendance = (lectureId: ID, studentId: ID, verification: Attendance["verification"]) =>
  api<Attendance>("PUT", "/api/attendance", { lectureId, studentId, verification });

/**
 * Imports the meeting provider's participant report for an ended lecture: students it saw are present;
 * everyone else enrolled is absent. Operations' own corrections are kept.
 */
export const importProviderAttendance = (lectureId: ID) => api<{ present: number; absent: number }>("POST", `/api/lectures/${enc(lectureId)}/attendance-import`);

/* ========================== Team & accounts ========================== */

export const inviteUser = (input: { name: string; email: string; role: Exclude<Role, "student"> }) =>
  api<{ user: User; activationPath: string }>("POST", "/api/team/invitations", input);

/** Role and status changes need a Super Admin; anyone may change their own name, phone and time zone. */
export const updateUser = (id: ID, patch: Partial<Pick<User, "name" | "phone" | "role" | "status" | "timeZone">>) => api<User>("PATCH", `/api/users/${enc(id)}`, patch);

export const revokeInvitation = (id: ID) => api<void>("DELETE", `/api/team/invitations/${enc(id)}`);

/** Accepts an invite: creates the account with this password. Resolves with the email to sign in with. */
export const activateAccount = (token: string, password: string) => api<{ email: string; role: Role }>("POST", "/api/auth/activate", { token, password });

/** Sends a reset link by email. Always resolves, so emails can't be probed. */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
  await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
}

/** Sets a new password for the person signed in through a reset link. */
export async function resetPassword(password: string): Promise<void> {
  if (password.length < 8) throw new ActionError("Use at least 8 characters.");
  const { error } = await createClient().auth.updateUser({ password });
  if (error) throw new ActionError(error.message);
}

export const changePassword = (_userId: ID, current: string, next: string) => api<void>("POST", "/api/me/password", { current, next });

/* =========================== Settings =========================== */

export const updateSettings = (patch: Partial<OrgSettings>) => api<OrgSettings>("PATCH", "/api/settings", patch);
