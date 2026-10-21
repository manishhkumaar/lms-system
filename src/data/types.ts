/*
 * Domain model, named exactly as in the product brief:
 * Course (curriculum) → Batch (one scheduled delivery) → Lecture (one live session) → Recording.
 * Lead (admissions pipeline) → Student (enrols in a batch, not a course).
 * A course is never "live"; a lecture is.
 */
import type { Role } from "@/design-system";

export type { Role };

export type ID = string;
/** ISO timestamp with offset, e.g. 2026-10-21T18:30:00+05:30 */
export type ISO = string;
/** Calendar date, YYYY-MM-DD */
export type DateStr = string;

export interface User {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  /**
   * "invited": an open invitation (id is the invitation's id) until the person activates their account;
   * then a profile (id is their auth user id).
   */
  status: "active" | "invited" | "suspended";
  /** Token for first-time account activation (invited users; visible to staff who can invite). */
  activationToken?: string;
  /** IANA zone the user sees times in. */
  timeZone: string;
  /** Set for role "student". */
  studentId?: ID;
  createdAt: ISO;
  lastActiveAt?: ISO;
}

export interface LectureTemplate {
  id: ID;
  title: string;
  durationMins: number;
  summary?: string;
}

export interface Module {
  id: ID;
  title: string;
  lectures: LectureTemplate[];
}

export interface Course {
  id: ID;
  /** Short code used in batch codes, e.g. FSW */
  code: string;
  title: string;
  summary: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  durationWeeks: number;
  /** Fee in rupees. */
  fee: number;
  status: "draft" | "published";
  /** Materials are optional at course level. When off, students don't see a Materials tab at all. */
  materialsEnabled: boolean;
  modules: Module[];
  designerId: ID;
  updatedAt: ISO;
}

export type MaterialKind = "notes" | "slides" | "pdf" | "link";

export interface Material {
  id: ID;
  courseId: ID;
  moduleId?: ID;
  title: string;
  kind: MaterialKind;
  /** For notes: the text. */
  body?: string;
  /** For links and files. */
  url?: string;
  fileName?: string;
  /** Path in the "materials" storage bucket, for uploaded slides and PDFs. */
  filePath?: string;
  sizeKb?: number;
  updatedAt: ISO;
}

/** Stored batch state. "upcoming" / "ongoing" / "completed" / "full" are derived from dates and seats. */
export type BatchLifecycle = "draft" | "active" | "cancelled";

export interface Batch {
  id: ID;
  /** e.g. FSW-07 */
  code: string;
  /** e.g. Full-Stack Web · Batch 07 */
  name: string;
  courseId: ID;
  startDate: DateStr;
  endDate: DateStr;
  capacity: number;
  instructors: string[];
  timeZone: string;
  /** Default lecture slot, used to prefill scheduling. */
  days: Array<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun">;
  slotStart: string; // "18:30"
  slotEnd: string; // "20:00"
  lifecycle: BatchLifecycle;
  /** Operations Manager who owns delivery. */
  ownerId?: ID;
  createdAt: ISO;
}

export interface Lecture {
  id: ID;
  batchId: ID;
  number: number;
  title: string;
  start: ISO;
  end: ISO;
  timeZone: string;
  instructor?: string;
  meetingUrl?: string;
  /** Join stays disabled for students until a link is published. */
  linkPublished: boolean;
  /** Stored state; live / ended / recording states are derived from time and recordings. */
  status: "scheduled" | "rescheduled" | "cancelled";
  /** Previous start, kept when rescheduled. */
  previousStart?: ISO;
  agenda?: string;
}

export interface Recording {
  id: ID;
  lectureId: ID;
  batchId: ID;
  title: string;
  durationMins: number;
  fileName: string;
  /** Path in the "recordings" storage bucket. Absent for seeded demo recordings. */
  filePath?: string;
  sizeMb: number;
  status: "processing" | "ready";
  uploadedAt: ISO;
  /** When processing finishes (simulated). */
  readyAt: ISO;
  uploadedBy: ID;
  /** Visible to students in the batch. */
  published: boolean;
  views: number;
}

export type LeadStage = "new" | "contacted" | "interview-scheduled" | "interviewed" | "selected" | "rejected" | "enrolled";
export type LeadSource = "Website" | "Instagram" | "Referral" | "Google Ads" | "WhatsApp" | "Walk-in" | "Webinar";

export interface LeadActivity {
  id: ID;
  at: ISO;
  by: string;
  kind: "note" | "call" | "stage" | "follow-up" | "interview" | "enrolment";
  text: string;
}

export interface Lead {
  id: ID;
  name: string;
  email: string;
  phone: string;
  city?: string;
  courseId: ID;
  source: LeadSource;
  stage: LeadStage;
  ownerId?: ID;
  interviewAt?: ISO;
  /** Next follow-up date. */
  followUpOn?: DateStr;
  createdAt: ISO;
  updatedAt: ISO;
  activity: LeadActivity[];
  /** Set once enrolled. */
  studentId?: ID;
  batchId?: ID;
  rejectionReason?: string;
}

export interface Student {
  id: ID;
  name: string;
  email: string;
  phone: string;
  city?: string;
  leadId?: ID;
  userId?: ID;
  createdAt: ISO;
}

export interface Enrolment {
  id: ID;
  studentId: ID;
  batchId: ID;
  enrolledAt: ISO;
  status: "active" | "completed" | "dropped" | "transferred";
  /** Fee in rupees. */
  feePaid: number;
  /** When transferred, the batch moved to. */
  transferredTo?: ID;
}

/**
 * Joined ≠ attended. A Join click sets joinedAt. Attendance counts only "present",
 * verified by the meeting provider or confirmed by Operations; until then it's "unverified".
 */
export interface Attendance {
  id: ID;
  lectureId: ID;
  studentId: ID;
  joinedAt?: ISO;
  verification: "unverified" | "present" | "absent";
  verifiedBy?: "provider" | "operations";
  verifiedAt?: ISO;
}

export interface OrgSettings {
  orgName: string;
  defaultTimeZone: string;
  joinOpensMinutesBefore: number;
  autoPublishRecordings: boolean;
  /** Link reminders go to Operations this many hours before a lecture with no link. */
  linkReminderHours: number;
  supportEmail: string;
}

/** Everything the signed-in person may see, as returned by GET /api/bootstrap (row-level security applied). */
export interface DB {
  version: number;
  /** The signed-in person's id (a key into users). */
  meId: ID;
  users: User[];
  courses: Course[];
  materials: Material[];
  batches: Batch[];
  lectures: Lecture[];
  recordings: Recording[];
  leads: Lead[];
  students: Student[];
  enrolments: Enrolment[];
  attendance: Attendance[];
  settings: OrgSettings;
}

export type CollectionKey = Exclude<keyof DB, "version" | "meId" | "settings">;

/**
 * Changes an API write sends back so the client store stays in step without refetching everything:
 * rows to insert or replace (matched by id) and ids to remove, per collection.
 */
export type Patch = { [K in CollectionKey]?: { upsert?: DB[K]; remove?: ID[] } } & { settings?: OrgSettings };

/** Shape of every API response. */
export interface ApiResponse<T = unknown> {
  result?: T;
  patch?: Patch;
  error?: string;
}
