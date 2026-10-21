/* Helpers shared by the delivery screens (Schedule, Lecture Details, Recordings, Attendance). */
import { useUser } from "@/auth/AuthContext";
import { getBatch, lectureLabel } from "@/data/selectors";
import type { DB, Lecture } from "@/data/types";
import { NAV, type Role } from "@/design-system";
import { formatDate, formatDayMonth } from "@/lib/format";
import { DEFAULT_TZ, tzLabel } from "@/lib/time";

export const DAY_MS = 86400000;

/** The viewer's zone and its label: times render in it and say which. */
export function useViewerZone() {
  const user = useUser();
  const tz = user.timeZone || DEFAULT_TZ;
  return { tz, label: tzLabel(tz) };
}

/** "Delivery / Schedule" for Operations, "Academics / Schedule" for Super Admin. */
export function navBreadcrumb(role: Role, key: string, label: string): string {
  const group = NAV[role]?.find((g) => g.items.some(([k]) => k === key))?.group;
  return group ? `${group} / ${label}` : label;
}

/** "FSW-07 · Lecture 12" */
export function lectureRef(db: DB, l: Lecture): string {
  return `${getBatch(db, l.batchId)?.code ?? "—"} · ${lectureLabel(l)}`;
}

/** "19–25 Oct 2026", "26 Oct – 1 Nov 2026", "29 Dec 2026 – 4 Jan 2027" */
export function weekRangeLabel(start: string, end: string): string {
  if (start.slice(0, 4) !== end.slice(0, 4)) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start.slice(0, 7) !== end.slice(0, 7)) return `${formatDayMonth(start)} – ${formatDate(end)}`;
  return `${Number(start.slice(8, 10))}–${formatDate(end)}`;
}

/** "Batch 07" from "Full-Stack Web · Batch 07" */
export function batchShortName(name: string | undefined): string {
  if (!name) return "this batch";
  const parts = name.split(" · ");
  return parts[parts.length - 1];
}
