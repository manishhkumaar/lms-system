/* Lead helpers shared by the admissions screens. */
import type { KanbanLead } from "@/design-system";
import { followUpDue, getBatch, getCourse, getUser, isLeadOpen } from "@/data/selectors";
import type { DB, Lead, LeadStage } from "@/data/types";
import { formatDayMonth, formatRelative, formatShortWhen } from "@/lib/format";
import { addDays, dateKey, DEFAULT_TZ } from "@/lib/time";

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  "interview-scheduled": "Interview scheduled",
  interviewed: "Interviewed",
  selected: "Selected",
  rejected: "Rejected",
  enrolled: "Enrolled",
};

/** The next logical step for a lead, shown as the panel's primary button. */
export const NEXT_STAGE: Partial<Record<LeadStage, { stage: LeadStage; label: string }>> = {
  new: { stage: "contacted", label: "Move to Contacted" },
  contacted: { stage: "interview-scheduled", label: "Schedule interview" },
  "interview-scheduled": { stage: "interviewed", label: "Move to Interviewed" },
  interviewed: { stage: "selected", label: "Move to Selected" },
  selected: { stage: "enrolled", label: "Enrol student" },
  rejected: { stage: "contacted", label: "Reopen lead" },
};

export const REJECT_REASONS = [
  "Didn't clear the interview",
  "Fee outside budget this year",
  "Prefers a weekend batch",
  "Chose a college programme instead",
  "Not reachable after three attempts",
];

/** Interviews are booked as 30-minute slots. */
export const INTERVIEW_MINS = 30;

/** "Full-Stack Web Development" → "Full-Stack Web" for cards. */
export function shortCourse(title?: string): string {
  return (title || "").replace(/ Development| Foundations| Essentials| with Python/g, "");
}

/** "today", "tomorrow", "overdue · 19 Oct", "23 Oct" */
export function followUpLabel(date: string, now: number): string {
  const today = dateKey(new Date(now), DEFAULT_TZ);
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  if (date < today) return `overdue · ${formatDayMonth(date)}`;
  return formatDayMonth(date);
}

export function ownerName(db: DB, l: Lead): string | undefined {
  return getUser(db, l.ownerId)?.name;
}

export function toKanbanLead(db: DB, l: Lead, now: number): KanbanLead {
  const due = followUpDue(l, now);
  const batch = l.stage === "enrolled" ? getBatch(db, l.batchId) : undefined;
  return {
    id: l.id,
    stage: l.stage,
    name: l.name,
    course: shortCourse(getCourse(db, l.courseId)?.title),
    source: l.source,
    interview: l.stage === "interview-scheduled" && l.interviewAt ? formatShortWhen(l.interviewAt) : undefined,
    followUp: isLeadOpen(l) && l.followUpOn ? followUpLabel(l.followUpOn, now) : undefined,
    followUpDue: due,
    updated: batch ? batch.name : formatRelative(l.updatedAt, now),
    owner: ownerName(db, l),
    status: due ? "follow-up-due" : undefined,
  };
}

/** Formats a 10-digit mobile number as "98480 12345". */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : raw.trim();
}

export const isValidEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());
export const isValidPhone = (s: string) => s.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").length === 10;
