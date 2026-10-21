import type { IconName } from "@/design-system";
import type { Batch, MaterialKind } from "@/data/types";
import { formatDayMonth, formatTimeRange, plural } from "@/lib/format";
import { tzLabel, zonedISO } from "@/lib/time";

/** "in 45 minutes", "in 2 hours", "tomorrow", "in 3 days", "on 25 Nov". */
export function startsIn(startMs: number, now: number, tz: string): string {
  const mins = Math.max(0, Math.round((startMs - now) / 60000));
  if (mins < 1) return "in less than a minute";
  if (mins < 60) return `in ${plural(mins, "minute")}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${plural(hours, "hour")}`;
  const days = Math.round(hours / 24);
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  return `on ${formatDayMonth(new Date(startMs), tz)}`;
}

/** "Mon, Wed, Fri · 6:30–8:00 PM IST", shown in the viewer's zone. */
export function scheduleLabel(b: Batch, tz: string): string {
  const s = zonedISO(b.startDate, b.slotStart, b.timeZone);
  const e = zonedISO(b.startDate, b.slotEnd, b.timeZone);
  return `${b.days.join(", ")} · ${formatTimeRange(s, e, tz)} ${tzLabel(tz, new Date(s))}`;
}

export const KIND_ICON: Record<MaterialKind, IconName> = { notes: "note", slides: "file", pdf: "file", link: "link" };
export const KIND_LABEL: Record<MaterialKind, string> = { notes: "Notes", slides: "Slides", pdf: "PDF", link: "Link" };

export function fileSize(kb?: number): string {
  if (!kb) return "";
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
