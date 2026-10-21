/*
 * Derived state. Live / ended / recording states of a lecture and upcoming / ongoing / full /
 * completed states of a batch come from time and data here, never stored.
 */
import type { Status } from "@/design-system";
import { dateKey, DEFAULT_TZ } from "@/lib/time";
import type { Attendance, Batch, DB, Enrolment, ID, Lead, Lecture, Recording, Student, User } from "./types";

/* ---------- lookups ---------- */
export const byId = <T extends { id: ID }>(xs: T[], id: ID | undefined): T | undefined => (id ? xs.find((x) => x.id === id) : undefined);
export const getUser = (db: DB, id?: ID) => byId(db.users, id);
export const getCourse = (db: DB, id?: ID) => byId(db.courses, id);
export const getBatch = (db: DB, id?: ID) => byId(db.batches, id);
export const getLecture = (db: DB, id?: ID) => byId(db.lectures, id);
export const getStudent = (db: DB, id?: ID) => byId(db.students, id);
export const getLead = (db: DB, id?: ID) => byId(db.leads, id);
export const getRecording = (db: DB, id?: ID) => byId(db.recordings, id);
export const getMaterial = (db: DB, id?: ID) => byId(db.materials, id);

/* ---------- lectures ---------- */
export type LectureState = "scheduled" | "rescheduled" | "link-missing" | "live" | "ended" | "recording-processing" | "recording-ready" | "cancelled";

export function recordingForLecture(db: DB, lectureId: ID): Recording | undefined {
  return db.recordings.find((r) => r.lectureId === lectureId);
}

/**
 * Before start: scheduled / rescheduled, or link-missing when no link is published.
 * Start → end: live. After end: ended until a recording is uploaded, then pending, then ready.
 */
export function lectureState(l: Lecture, rec: Recording | undefined, now: number): LectureState {
  if (l.status === "cancelled") return "cancelled";
  const start = new Date(l.start).getTime();
  const end = new Date(l.end).getTime();
  if (now < start) return !l.linkPublished ? "link-missing" : l.status === "rescheduled" ? "rescheduled" : "scheduled";
  if (now < end) return "live";
  if (!rec) return "ended";
  return rec.status === "ready" ? "recording-ready" : "recording-processing";
}

export function lectureStateIn(db: DB, l: Lecture, now: number): LectureState {
  return lectureState(l, recordingForLecture(db, l.id), now);
}

export function batchLectures(db: DB, batchId: ID): Lecture[] {
  return db.lectures.filter((l) => l.batchId === batchId).sort((a, b) => a.start.localeCompare(b.start) || a.number - b.number);
}

export function isEnded(l: Lecture, now: number) {
  return l.status !== "cancelled" && new Date(l.end).getTime() <= now;
}

export function isLive(l: Lecture, now: number) {
  return l.status !== "cancelled" && new Date(l.start).getTime() <= now && now < new Date(l.end).getTime();
}

/** Lectures happening on a calendar day in a zone. */
export function lecturesOnDay(db: DB, day: string, tz: string = DEFAULT_TZ): Lecture[] {
  return db.lectures.filter((l) => dateKey(l.start, tz) === day).sort((a, b) => a.start.localeCompare(b.start));
}

/** "Lecture 13" */
export function lectureLabel(l: Lecture) {
  return `Lecture ${l.number}`;
}

/* ---------- batches ---------- */
export type BatchState = "draft" | "upcoming" | "ongoing" | "full" | "completed" | "cancelled";

export function activeEnrolments(db: DB, batchId: ID): Enrolment[] {
  return db.enrolments.filter((e) => e.batchId === batchId && (e.status === "active" || e.status === "completed"));
}

export function seatsFilled(db: DB, batchId: ID): number {
  return activeEnrolments(db, batchId).length;
}

export function batchState(b: Batch, filled: number, now: number, tz: string = DEFAULT_TZ): BatchState {
  if (b.lifecycle === "draft") return "draft";
  if (b.lifecycle === "cancelled") return "cancelled";
  const today = dateKey(new Date(now), tz);
  if (today > b.endDate) return "completed";
  if (today < b.startDate) return filled >= b.capacity ? "full" : "upcoming";
  return "ongoing";
}

export function batchStateIn(db: DB, b: Batch, now: number): BatchState {
  return batchState(b, seatsFilled(db, b.id), now, b.timeZone);
}

export function batchStudents(db: DB, batchId: ID): Student[] {
  const ids = new Set(activeEnrolments(db, batchId).map((e) => e.studentId));
  return db.students.filter((s) => ids.has(s.id));
}

/** Batches a student can join now: not draft/cancelled/completed, with seats left. */
export function openBatches(db: DB, now: number, courseId?: ID): Batch[] {
  return db.batches.filter((b) => {
    if (courseId && b.courseId !== courseId) return false;
    const st = batchStateIn(db, b, now);
    return (st === "upcoming" || st === "ongoing") && seatsFilled(db, b.id) < b.capacity;
  });
}

/* ---------- students ---------- */
export function studentEnrolments(db: DB, studentId: ID): Enrolment[] {
  return db.enrolments.filter((e) => e.studentId === studentId).sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
}

export function studentActiveBatches(db: DB, studentId: ID): Batch[] {
  const ids = new Set(db.enrolments.filter((e) => e.studentId === studentId && (e.status === "active" || e.status === "completed")).map((e) => e.batchId));
  return db.batches.filter((b) => ids.has(b.id));
}

export function isEnrolledIn(db: DB, studentId: ID | undefined, batchId: ID): boolean {
  if (!studentId) return false;
  return db.enrolments.some((e) => e.studentId === studentId && e.batchId === batchId && e.status === "active");
}

/** The lecture to show on the student's live-class card: one that's live now, else the next upcoming. */
export function nextLectureForStudent(db: DB, studentId: ID, now: number): Lecture | undefined {
  const batchIds = new Set(db.enrolments.filter((e) => e.studentId === studentId && e.status === "active").map((e) => e.batchId));
  const mine = db.lectures.filter((l) => batchIds.has(l.batchId) && l.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start));
  return mine.find((l) => isLive(l, now)) || mine.find((l) => new Date(l.start).getTime() > now);
}

/** The most recent lecture that ended, for the "after class" state. */
export function lastEndedLectureForStudent(db: DB, studentId: ID, now: number): Lecture | undefined {
  const batchIds = new Set(db.enrolments.filter((e) => e.studentId === studentId && e.status === "active").map((e) => e.batchId));
  return db.lectures
    .filter((l) => batchIds.has(l.batchId) && isEnded(l, now))
    .sort((a, b) => b.end.localeCompare(a.end))[0];
}

/* ---------- attendance (joined ≠ attended) ---------- */
export type AttendanceStatus = Extract<Status, "present" | "absent" | "joined" | "unverified">;

export function attendanceRecord(db: DB, lectureId: ID, studentId: ID): Attendance | undefined {
  return db.attendance.find((a) => a.lectureId === lectureId && a.studentId === studentId);
}

/** Present/absent once verified; otherwise "joined" if they clicked Join, else "unverified". */
export function attendanceStatus(a: Attendance | undefined): AttendanceStatus {
  if (a?.verification === "present") return "present";
  if (a?.verification === "absent") return "absent";
  if (a?.joinedAt) return "joined";
  return "unverified";
}

export interface AttendanceSummary {
  /** Ended, non-cancelled lectures counted. */
  held: number;
  present: number;
  absent: number;
  unverified: number;
  /** present / held, 0–100. Only verified presence counts. */
  pct: number;
}

/** Verified attendance for one student in one batch. */
export function studentAttendance(db: DB, studentId: ID, batchId: ID, now: number): AttendanceSummary {
  const held = batchLectures(db, batchId).filter((l) => isEnded(l, now));
  let present = 0;
  let absent = 0;
  for (const l of held) {
    const a = attendanceRecord(db, l.id, studentId);
    if (a?.verification === "present") present++;
    else if (a?.verification === "absent") absent++;
  }
  const unverified = held.length - present - absent;
  return { held: held.length, present, absent, unverified, pct: held.length ? (present / held.length) * 100 : 0 };
}

/** Verified attendance for a lecture. */
export function lectureAttendance(db: DB, lecture: Lecture): AttendanceSummary & { joined: number; expected: number } {
  const students = batchStudents(db, lecture.batchId);
  let present = 0;
  let absent = 0;
  let joined = 0;
  for (const s of students) {
    const a = attendanceRecord(db, lecture.id, s.id);
    if (a?.joinedAt) joined++;
    if (a?.verification === "present") present++;
    else if (a?.verification === "absent") absent++;
  }
  const expected = students.length;
  return { held: 1, present, absent, unverified: expected - present - absent, joined, expected, pct: expected ? (present / expected) * 100 : 0 };
}

/** Verified attendance across a set of ended lectures (a batch, or everything). */
export function verifiedAttendanceRate(db: DB, now: number, filter?: { batchId?: ID; sinceMs?: number }): { present: number; expected: number; pct: number } {
  let present = 0;
  let expected = 0;
  const enrolledByBatch = new Map<ID, Set<ID>>();
  for (const l of db.lectures) {
    if (filter?.batchId && l.batchId !== filter.batchId) continue;
    if (!isEnded(l, now)) continue;
    if (filter?.sinceMs && new Date(l.start).getTime() < filter.sinceMs) continue;
    let set = enrolledByBatch.get(l.batchId);
    if (!set) {
      set = new Set(activeEnrolments(db, l.batchId).map((e) => e.studentId));
      enrolledByBatch.set(l.batchId, set);
    }
    expected += set.size;
  }
  const lectures = new Map(db.lectures.map((l) => [l.id, l]));
  for (const a of db.attendance) {
    if (a.verification !== "present") continue;
    const l = lectures.get(a.lectureId);
    if (!l || (filter?.batchId && l.batchId !== filter.batchId) || !isEnded(l, now)) continue;
    if (filter?.sinceMs && new Date(l.start).getTime() < filter.sinceMs) continue;
    if (!enrolledByBatch.get(l.batchId)?.has(a.studentId)) continue;
    present++;
  }
  return { present, expected, pct: expected ? (present / expected) * 100 : 0 };
}

/** Share of the batch's planned lectures the student was verified present for, 0–100. */
export function studentProgress(db: DB, studentId: ID, batchId: ID): number {
  const lectures = batchLectures(db, batchId).filter((l) => l.status !== "cancelled");
  if (!lectures.length) return 0;
  const ids = new Set(lectures.map((l) => l.id));
  const present = db.attendance.filter((a) => a.studentId === studentId && ids.has(a.lectureId) && a.verification === "present").length;
  return Math.round((present / lectures.length) * 100);
}

/* ---------- leads ---------- */
export const LEAD_STAGES = ["new", "contacted", "interview-scheduled", "interviewed", "selected", "rejected", "enrolled"] as const;

export function isLeadOpen(l: Lead) {
  return l.stage !== "enrolled" && l.stage !== "rejected";
}

/** Follow-up date is today or earlier on an open lead. */
export function followUpDue(l: Lead, now: number, tz: string = DEFAULT_TZ): boolean {
  if (!l.followUpOn || !isLeadOpen(l)) return false;
  return l.followUpOn <= dateKey(new Date(now), tz);
}

export function followUpOverdue(l: Lead, now: number, tz: string = DEFAULT_TZ): boolean {
  if (!l.followUpOn || !isLeadOpen(l)) return false;
  return l.followUpOn < dateKey(new Date(now), tz);
}

/** Staff who can own leads. */
export function admissionsTeam(db: DB): User[] {
  return db.users.filter((u) => (u.role === "admissions" || u.role === "super-admin") && u.status === "active");
}

/** Courses a student can see materials for (materials toggled on). */
export function studentHasMaterials(db: DB, studentId: ID): boolean {
  return studentActiveBatches(db, studentId).some((b) => getCourse(db, b.courseId)?.materialsEnabled);
}
