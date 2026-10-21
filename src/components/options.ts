/* Option lists for SelectFields, labelled the way the content rules ask. */
import { seatsLabel } from "@/lib/format";
import { batchStateIn, openBatches, seatsFilled } from "@/data/selectors";
import type { Batch, DB, ID, Role } from "@/data/types";

export function courseOptions(db: DB, opts: { publishedOnly?: boolean } = {}) {
  return db.courses.filter((c) => !opts.publishedOnly || c.status === "published").map((c) => ({ value: c.id, label: c.title }));
}

/** "FSW-07 · Full-Stack Web · Batch 07 · 42 of 50 seats filled" */
export function batchLabel(db: DB, b: Batch) {
  return `${b.code} · ${b.name} · ${seatsLabel(seatsFilled(db, b.id), b.capacity)}`;
}

/** Batches a student can be enrolled in now, those of `courseId` first. */
export function enrolBatchOptions(db: DB, now: number, courseId?: ID, exclude?: ID) {
  const open = openBatches(db, now).filter((b) => b.id !== exclude);
  open.sort((a, b) => Number(b.courseId === courseId) - Number(a.courseId === courseId) || a.startDate.localeCompare(b.startDate));
  return open.map((b) => ({ value: b.id, label: batchLabel(db, b) }));
}

/** All batches that can hold lectures (not draft-only filter: drafts can be scheduled ahead). */
export function scheduleBatchOptions(db: DB, now: number) {
  return db.batches
    .filter((b) => {
      const st = batchStateIn(db, b, now);
      return st !== "cancelled" && st !== "completed";
    })
    .map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }));
}

export function staffOptions(db: DB, roles: Role[]) {
  return db.users.filter((u) => roles.includes(u.role) && u.status === "active").map((u) => ({ value: u.id, label: u.name }));
}

export const LEAD_SOURCES = ["Website", "Instagram", "Referral", "Google Ads", "WhatsApp", "Walk-in", "Webinar"] as const;
