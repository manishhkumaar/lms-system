/* Row shapes of the Postgres tables (supabase/migrations). */
import type { Role } from "@/data/types";

export interface ProfileRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: "active" | "suspended";
  time_zone: string;
  created_at: string;
  last_active_at: string | null;
}

export interface InvitationRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  student_id: string | null;
  token: string;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
}

export interface CourseRow {
  id: string;
  code: string;
  title: string;
  summary: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration_weeks: number;
  fee: number;
  status: "draft" | "published";
  materials_enabled: boolean;
  designer_id: string | null;
  updated_at: string;
}

export interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

export interface TemplateRow {
  id: string;
  module_id: string;
  title: string;
  duration_mins: number;
  summary: string | null;
  position: number;
}

export interface MaterialRow {
  id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  kind: "notes" | "slides" | "pdf" | "link";
  body: string | null;
  url: string | null;
  file_name: string | null;
  file_path: string | null;
  size_kb: number | null;
  updated_at: string;
}

export interface BatchRow {
  id: string;
  code: string;
  name: string;
  course_id: string;
  start_date: string;
  end_date: string;
  capacity: number;
  instructors: string[];
  time_zone: string;
  days: string[];
  slot_start: string;
  slot_end: string;
  lifecycle: "draft" | "active" | "cancelled";
  owner_id: string | null;
  created_at: string;
}

export interface LectureRow {
  id: string;
  batch_id: string;
  number: number;
  title: string;
  start_at: string;
  end_at: string;
  time_zone: string;
  instructor: string | null;
  status: "scheduled" | "rescheduled" | "cancelled";
  previous_start: string | null;
  agenda: string | null;
}

export interface LinkRow {
  lecture_id: string;
  meeting_url: string;
  published: boolean;
  updated_at: string;
}

export interface RecordingRow {
  id: string;
  lecture_id: string;
  batch_id: string;
  title: string;
  duration_mins: number;
  file_name: string;
  file_path: string | null;
  size_mb: number | string;
  status: "processing" | "ready";
  uploaded_at: string;
  ready_at: string;
  uploaded_by: string | null;
  published: boolean;
  views: number;
}

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string | null;
  lead_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string | null;
  course_id: string;
  source: string;
  stage: string;
  owner_id: string | null;
  interview_at: string | null;
  follow_up_on: string | null;
  created_at: string;
  updated_at: string;
  student_id: string | null;
  batch_id: string | null;
  rejection_reason: string | null;
}

export interface ActivityRow {
  id: string;
  lead_id: string;
  at: string;
  by_name: string;
  kind: "note" | "call" | "stage" | "follow-up" | "interview" | "enrolment";
  text: string;
}

export interface EnrolmentRow {
  id: string;
  student_id: string;
  batch_id: string;
  enrolled_at: string;
  status: "active" | "completed" | "dropped" | "transferred";
  fee_paid: number;
  transferred_to: string | null;
}

export interface AttendanceRow {
  id: string;
  lecture_id: string;
  student_id: string;
  joined_at: string | null;
  verification: "unverified" | "present" | "absent";
  verified_by: "provider" | "operations" | null;
  verified_at: string | null;
}

export interface SettingsRow {
  id: number;
  org_name: string;
  default_time_zone: string;
  join_opens_minutes_before: number;
  auto_publish_recordings: boolean;
  link_reminder_hours: number;
  support_email: string;
}
