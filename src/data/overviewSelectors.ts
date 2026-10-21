/*
 * Derived numbers for the Dashboard and Reports. Read-only: everything here is computed from the
 * DB and the current time, never stored.
 */
import { addDays, dateKey, DEFAULT_TZ, startOfWeek, zonedISO } from "@/lib/time";
import {
  activeEnrolments,
  batchLectures,
  batchStateIn,
  getCourse,
  isEnded,
  isLive,
  LEAD_STAGES,
  lecturesOnDay,
  recordingForLecture,
  seatsFilled,
  verifiedAttendanceRate,
} from "./selectors";
import type { Batch, DB, Enrolment, ID, Lead, LeadSource, LeadStage, Lecture } from "./types";

const DAY = 86400000;

export type Period = "30d" | "90d" | "year";

export const PERIOD_LABEL: Record<Period, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
};

/** Midnight at the start of a calendar date in a zone, as ms. */
export function dayStartMs(date: string, tz: string = DEFAULT_TZ): number {
  return new Date(zonedISO(date, "00:00", tz)).getTime();
}

export function periodStart(period: Period, now: number, tz: string = DEFAULT_TZ): number {
  if (period === "30d") return now - 30 * DAY;
  if (period === "90d") return now - 90 * DAY;
  return dayStartMs(`${dateKey(new Date(now), tz).slice(0, 4)}-01-01`, tz);
}

export function monthStartMs(now: number, tz: string = DEFAULT_TZ): number {
  return dayStartMs(`${dateKey(new Date(now), tz).slice(0, 7)}-01`, tz);
}

export function previousMonthStartMs(now: number, tz: string = DEFAULT_TZ): number {
  const [y, m] = dateKey(new Date(now), tz).split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return dayStartMs(`${py}-${String(pm).padStart(2, "0")}-01`, tz);
}

/** [Monday 00:00, next Monday 00:00) of the current week in a zone. */
export function weekRangeMs(now: number, tz: string = DEFAULT_TZ): [number, number] {
  const monday = startOfWeek(dateKey(new Date(now), tz));
  return [dayStartMs(monday, tz), dayStartMs(addDays(monday, 7), tz)];
}

/* ---------------- enrolments & students ---------------- */

/** Students with at least one active enrolment. */
export function activeStudentCount(db: DB): number {
  return new Set(db.enrolments.filter((e) => e.status === "active").map((e) => e.studentId)).size;
}

/**
 * New joins dated within [from, to]. Enrolments created by a transfer are moves, not joins,
 * and anything dated after `to` (e.g. now) is ignored.
 */
export function newEnrolments(db: DB, from: number, to: number): Enrolment[] {
  const movedInto = new Set(db.enrolments.filter((e) => e.status === "transferred" && e.transferredTo).map((e) => `${e.studentId}:${e.transferredTo}`));
  return db.enrolments.filter((e) => {
    const t = Date.parse(e.enrolledAt);
    return t >= from && t <= to && !movedInto.has(`${e.studentId}:${e.batchId}`);
  });
}

/** Fees recorded at enrolment within the window, in rupees. */
export function feesCollected(db: DB, from: number, to: number): number {
  return newEnrolments(db, from, to).reduce((sum, e) => sum + e.feePaid, 0);
}

export interface SeriesPoint {
  key: string;
  label: string;
  /** Longer label for tooltips and tables, e.g. "Week of 12 Oct". */
  long: string;
  value: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

function dayMonth(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** New enrolments per week (30 / 90 days) or per month (this year). */
export function enrolmentSeries(db: DB, period: Period, now: number, tz: string = DEFAULT_TZ): SeriesPoint[] {
  const from = periodStart(period, now, tz);
  const joins = newEnrolments(db, from, now);
  const out: SeriesPoint[] = [];
  if (period === "year") {
    const [y, m] = dateKey(new Date(now), tz).split("-").map(Number);
    for (let i = 1; i <= m; i++) {
      const key = `${y}-${String(i).padStart(2, "0")}`;
      out.push({ key, label: MONTHS[i - 1], long: `${MONTHS[i - 1]} ${y}`, value: 0 });
    }
    for (const e of joins) {
      const k = dateKey(e.enrolledAt, tz).slice(0, 7);
      const p = out.find((x) => x.key === k);
      if (p) p.value++;
    }
    return out;
  }
  let week = startOfWeek(dateKey(new Date(from), tz));
  const last = startOfWeek(dateKey(new Date(now), tz));
  while (week <= last) {
    out.push({ key: week, label: dayMonth(week), long: `Week of ${dayMonth(week)}`, value: 0 });
    week = addDays(week, 7);
  }
  for (const e of joins) {
    const k = startOfWeek(dateKey(e.enrolledAt, tz));
    const p = out.find((x) => x.key === k);
    if (p) p.value++;
  }
  return out;
}

/* ---------------- leads ---------------- */

export function leadsCreated(db: DB, from: number, to: number): Lead[] {
  return db.leads.filter((l) => {
    const t = Date.parse(l.createdAt);
    return t >= from && t <= to;
  });
}

/** Of the leads created in the window, how many are now enrolled. */
export function leadConversion(db: DB, from: number, to: number): { created: number; enrolled: number; pct: number } {
  const leads = leadsCreated(db, from, to);
  const enrolled = leads.filter((l) => l.stage === "enrolled").length;
  return { created: leads.length, enrolled, pct: leads.length ? (enrolled / leads.length) * 100 : 0 };
}

const SOURCES: LeadSource[] = ["Website", "Instagram", "Referral", "Google Ads", "WhatsApp", "Walk-in", "Webinar"];

export function leadsBySource(db: DB, from: number, to: number): Array<{ source: LeadSource; count: number }> {
  const leads = leadsCreated(db, from, to);
  return SOURCES.map((source) => ({ source, count: leads.filter((l) => l.source === source).length })).sort((a, b) => b.count - a.count);
}

export function pipelineByStage(leads: Lead[]): Array<{ stage: LeadStage; count: number }> {
  return LEAD_STAGES.map((stage) => ({ stage, count: leads.filter((l) => l.stage === stage).length }));
}

/** The date an enrolled lead was enrolled, from its activity log. */
export function leadEnrolledAt(l: Lead): number | undefined {
  const a = l.activity.find((x) => x.kind === "enrolment");
  return a ? Date.parse(a.at) : undefined;
}

/* ---------------- lectures & attendance ---------------- */

export function liveLectures(db: DB, now: number): Lecture[] {
  return db.lectures.filter((l) => isLive(l, now)).sort((a, b) => a.start.localeCompare(b.start));
}

export function todaysLectures(db: DB, now: number, tz: string = DEFAULT_TZ): Lecture[] {
  return lecturesOnDay(db, dateKey(new Date(now), tz), tz);
}

export function nextUpcomingLecture(db: DB, now: number): Lecture | undefined {
  return db.lectures.filter((l) => l.status !== "cancelled" && Date.parse(l.start) > now).sort((a, b) => a.start.localeCompare(b.start))[0];
}

/** Students who clicked Join for a lecture. Not attendance. */
export function joinedCount(db: DB, lectureId: ID): number {
  return db.attendance.filter((a) => a.lectureId === lectureId && a.joinedAt).length;
}

export interface BatchAttendanceRow {
  batch: Batch;
  present: number;
  expected: number;
  pct: number;
}

/** Verified attendance per batch for lectures held since `from`. Batches with nothing held are left out. */
export function attendanceByBatch(db: DB, now: number, from: number): BatchAttendanceRow[] {
  return db.batches
    .map((batch) => ({ batch, ...verifiedAttendanceRate(db, now, { batchId: batch.id, sinceMs: from }) }))
    .filter((r) => r.expected > 0)
    .sort((a, b) => b.pct - a.pct);
}

export interface BatchSummaryRow {
  id: ID;
  batch: Batch;
  course: string;
  filled: number;
  capacity: number;
  held: number;
  planned: number;
  attendancePct: number;
  hasAttendance: boolean;
  recordingsPublished: number;
  state: ReturnType<typeof batchStateIn>;
}

export function batchSummary(db: DB, now: number): BatchSummaryRow[] {
  return db.batches
    .filter((b) => b.lifecycle !== "cancelled")
    .map((b) => {
      const lectures = batchLectures(db, b.id).filter((l) => l.status !== "cancelled");
      const held = lectures.filter((l) => isEnded(l, now));
      const rate = verifiedAttendanceRate(db, now, { batchId: b.id });
      const recordingsPublished = held.filter((l) => {
        const r = recordingForLecture(db, l.id);
        return r?.status === "ready" && r.published;
      }).length;
      return {
        id: b.id,
        batch: b,
        course: getCourse(db, b.courseId)?.title || "",
        filled: seatsFilled(db, b.id),
        capacity: b.capacity,
        held: held.length,
        planned: lectures.length,
        attendancePct: rate.pct,
        hasAttendance: rate.expected > 0,
        recordingsPublished,
        state: batchStateIn(db, b, now),
      };
    })
    .sort((a, b) => b.batch.startDate.localeCompare(a.batch.startDate));
}

/** Ongoing, upcoming and full batches, soonest relevant first. */
export function runningBatches(db: DB, now: number): Array<{ batch: Batch; filled: number; state: ReturnType<typeof batchStateIn> }> {
  const order = { ongoing: 0, full: 1, upcoming: 2, draft: 3, completed: 4, cancelled: 5 } as const;
  return db.batches
    .map((batch) => ({ batch, filled: activeEnrolments(db, batch.id).length, state: batchStateIn(db, batch, now) }))
    .filter((x) => x.state === "ongoing" || x.state === "upcoming" || x.state === "full")
    .sort((a, b) => order[a.state] - order[b.state] || a.batch.startDate.localeCompare(b.batch.startDate));
}
