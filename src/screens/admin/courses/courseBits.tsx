import type { Course, MaterialKind } from "@/data/types";
import { StatusChip, type IconName } from "@/design-system";

/** Published / Draft. A course is never "live". */
export function CourseStatusChip({ course }: { course: Pick<Course, "status"> }) {
  return course.status === "published" ? (
    <StatusChip status="published" tone="success">
      Published
    </StatusChip>
  ) : (
    <StatusChip status="draft" />
  );
}

export function MaterialsChip({ on }: { on: boolean }) {
  return <StatusChip status={on ? "materials-on" : "materials-off"} />;
}

export const KIND_LABEL: Record<MaterialKind, string> = { notes: "Notes", slides: "Slides", pdf: "PDF", link: "Link" };
export const KIND_ICON: Record<MaterialKind, IconName> = { notes: "note", slides: "file", pdf: "file", link: "link" };
export const KIND_OPTIONS = (Object.keys(KIND_LABEL) as MaterialKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }));

export const LEVELS: Course["level"][] = ["Beginner", "Intermediate", "Advanced"];

export function templateCount(course: Course) {
  return course.modules.reduce((n, m) => n + m.lectures.length, 0);
}

export function templateMinutes(course: Course) {
  return course.modules.reduce((n, m) => n + m.lectures.reduce((x, l) => x + l.durationMins, 0), 0);
}
