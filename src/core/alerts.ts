/*
 * Operational alerts for a role, computed from data: the bell menu and dashboards use these.
 * Copy is plain and operational ("2 links not published").
 */
import { useMemo } from "react";
import type { Tone } from "@/design-system";
import { formatShortWhen, plural } from "@/lib/format";
import { DEFAULT_TZ } from "@/lib/time";
import { followUpDue, getBatch, isEnded, isLive, lectureAttendance, lectureLabel, recordingForLecture } from "@/data/selectors";
import type { DB, Role } from "@/data/types";
import { useDb } from "@/data/store";
import { useNow } from "@/lib/useNow";

export interface Alert {
  id: string;
  text: string;
  to: string;
  tone: Tone;
}

export function computeAlerts(db: DB, role: Role, now: number, userId?: string): Alert[] {
  const out: Alert[] = [];
  const ops = role === "super-admin" || role === "operations";
  const adm = role === "super-admin" || role === "admissions" || role === "operations";

  if (ops) {
    const reminderMs = db.settings.linkReminderHours * 3600000;
    const missing = db.lectures.filter((l) => l.status !== "cancelled" && !l.linkPublished && new Date(l.start).getTime() > now && new Date(l.start).getTime() - now < reminderMs);
    for (const l of missing) {
      const b = getBatch(db, l.batchId);
      out.push({ id: `link-${l.id}`, text: `Link not published: ${b?.code} ${lectureLabel(l)}, ${formatShortWhen(l.start, l.timeZone)}`, to: `/admin/lectures/${l.id}`, tone: "warning" });
    }
    const live = db.lectures.filter((l) => isLive(l, now));
    for (const l of live) {
      const b = getBatch(db, l.batchId);
      out.push({ id: `live-${l.id}`, text: `Live now: ${b?.code} ${lectureLabel(l)} · ${l.title}`, to: `/admin/lectures/${l.id}`, tone: "danger" });
    }
    const weekAgo = now - 7 * 86400000;
    const needsRecording = db.lectures.filter((l) => isEnded(l, now) && new Date(l.end).getTime() > weekAgo && !recordingForLecture(db, l.id));
    for (const l of needsRecording) {
      const b = getBatch(db, l.batchId);
      out.push({ id: `rec-${l.id}`, text: `Recording to upload: ${b?.code} ${lectureLabel(l)} · ${l.title}`, to: `/admin/lectures/${l.id}`, tone: "warning" });
    }
    const unpublished = db.recordings.filter((r) => r.status === "ready" && !r.published);
    if (unpublished.length) out.push({ id: "rec-unpublished", text: `${plural(unpublished.length, "recording")} ready but not published to students`, to: "/admin/recordings", tone: "info" });
    const unverified = db.lectures.filter((l) => isEnded(l, now) && new Date(l.end).getTime() >= weekAgo && lectureAttendance(db, l).unverified > 0);
    if (unverified.length) out.push({ id: "att-unverified", text: `Attendance not verified for ${plural(unverified.length, "lecture")}`, to: "/admin/attendance", tone: "neutral" });
  }

  if (adm) {
    const mine = db.leads.filter((l) => followUpDue(l, now, DEFAULT_TZ) && (role !== "admissions" || l.ownerId === userId));
    if (mine.length) out.push({ id: "followups", text: `${plural(mine.length, "follow-up")} due today or overdue`, to: "/admin/leads?due=1", tone: "warning" });
    const unassigned = db.leads.filter((l) => l.stage === "new" && !l.ownerId);
    if (unassigned.length && role !== "operations") out.push({ id: "unassigned", text: `${plural(unassigned.length, "new lead")} without an owner`, to: "/admin/leads?owner=none", tone: "info" });
  }

  if (role === "course-designer" || role === "super-admin") {
    const drafts = db.courses.filter((c) => c.status === "draft");
    for (const c of drafts) out.push({ id: `draft-${c.id}`, text: `${c.title} is still a draft`, to: `/admin/courses/${c.id}`, tone: "neutral" });
  }

  return out;
}

export function useAlerts(role: Role, userId?: string): Alert[] {
  const db = useDb();
  const now = useNow(30000);
  return useMemo(() => computeAlerts(db, role, now, userId), [db, role, now, userId]);
}
