import type { ReactNode } from "react";
import { cx, type Tone } from "../utils";

export const STATUS = {
  /* leads */
  new: ["neutral", "New"],
  contacted: ["info", "Contacted"],
  "interview-scheduled": ["info", "Interview scheduled"],
  interviewed: ["info", "Interviewed"],
  selected: ["success", "Selected"],
  rejected: ["danger", "Rejected"],
  enrolled: ["success", "Enrolled"],
  "follow-up-due": ["warning", "Follow-up due"],
  /* batches */
  draft: ["neutral", "Draft"],
  upcoming: ["info", "Upcoming"],
  ongoing: ["success", "Ongoing"],
  completed: ["neutral", "Completed"],
  cancelled: ["danger", "Cancelled"],
  full: ["warning", "Full"],
  /* lectures */
  scheduled: ["neutral", "Scheduled"],
  "link-missing": ["warning", "Link not published"],
  live: ["danger", "Live"],
  ended: ["neutral", "Ended"],
  "recording-processing": ["warning", "Recording pending"],
  "recording-ready": ["success", "Recording ready"],
  rescheduled: ["warning", "Rescheduled"],
  /* attendance */
  joined: ["info", "Joined"],
  present: ["success", "Present · verified"],
  absent: ["danger", "Absent"],
  unverified: ["neutral", "Unverified"],
  /* materials */
  "materials-on": ["success", "Materials on"],
  "materials-off": ["neutral", "Materials off"],
} as const satisfies Record<string, readonly [Tone, string]>;

export type Status = keyof typeof STATUS;

export interface StatusChipProps {
  status: Status | (string & {});
  tone?: Tone;
  dot?: boolean;
  children?: ReactNode;
  className?: string;
}

export function StatusChip({ status, tone, dot, children, className }: StatusChipProps) {
  const s = (STATUS as Record<string, readonly [Tone, string]>)[status] || [tone || "neutral", status];
  const t = tone || s[0];
  const isLive = status === "live";
  return (
    <span className={cx("bl-chip", `bl-chip-${t}`, isLive && "bl-chip-live", className)}>
      {dot !== false ? <span className="bl-chip-dot" aria-hidden="true" /> : null}
      {children || s[1]}
    </span>
  );
}

export function statusLabel(status: Status): string {
  return STATUS[status][1];
}
