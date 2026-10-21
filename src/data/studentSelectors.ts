/*
 * Student-portal views of the data. A student sees only batches they're enrolled in (active or
 * completed), and only recordings that are processed and published to their batch.
 */
import { batchLectures, getBatch, getCourse, lectureStateIn, recordingForLecture, type LectureState } from "./selectors";
import type { Batch, Course, DB, ID, Lecture, LectureTemplate, Material, Module, Recording } from "./types";

/** Enrolled in the batch now or in the past (completed). */
export function isInBatch(db: DB, studentId: ID | undefined, batchId: ID): boolean {
  if (!studentId) return false;
  return db.enrolments.some((e) => e.studentId === studentId && e.batchId === batchId && (e.status === "active" || e.status === "completed"));
}

/** The recording a student can watch: processed and published. */
export function visibleRecording(db: DB, lectureId: ID): Recording | undefined {
  const r = recordingForLecture(db, lectureId);
  return r && r.status === "ready" && r.published ? r : undefined;
}

/** Lecture state as a student sees it: a ready but unpublished recording is still pending. */
export function studentLectureState(db: DB, lecture: Lecture, now: number): LectureState {
  const st = lectureStateIn(db, lecture, now);
  if (st === "recording-ready" && !visibleRecording(db, lecture.id)) return "recording-processing";
  return st;
}

/** All lectures of these batches, oldest first. */
export function lecturesForBatches(db: DB, batchIds: ID[]): Lecture[] {
  const set = new Set(batchIds);
  return db.lectures.filter((l) => set.has(l.batchId)).sort((a, b) => a.start.localeCompare(b.start) || a.number - b.number);
}

/** Watchable recordings for these batches, newest lecture first. */
export function recordingsForBatches(db: DB, batchIds: ID[]): Array<{ recording: Recording; lecture: Lecture; batch: Batch }> {
  const set = new Set(batchIds);
  const out: Array<{ recording: Recording; lecture: Lecture; batch: Batch }> = [];
  for (const r of db.recordings) {
    if (!set.has(r.batchId) || r.status !== "ready" || !r.published) continue;
    const lecture = db.lectures.find((l) => l.id === r.lectureId);
    const batch = getBatch(db, r.batchId);
    if (lecture && batch) out.push({ recording: r, lecture, batch });
  }
  return out.sort((a, b) => b.lecture.start.localeCompare(a.lecture.start));
}

/** The course template a lecture was scheduled from: by title, else by position. */
export function templateForLecture(course: Course | undefined, lecture: Lecture): { module?: Module; template?: LectureTemplate } {
  if (!course) return {};
  for (const m of course.modules) {
    const t = m.lectures.find((x) => x.title === lecture.title);
    if (t) return { module: m, template: t };
  }
  let i = 0;
  for (const m of course.modules) {
    for (const t of m.lectures) {
      i++;
      if (i === lecture.number) return { module: m, template: t };
    }
  }
  return {};
}

/** Each module's templates paired with this batch's lecture for them (by title, else by order). */
export function curriculumForBatch(db: DB, batch: Batch): { modules: Array<{ module: Module; rows: Array<{ template: LectureTemplate; lecture?: Lecture }> }>; extra: Lecture[] } {
  const course = getCourse(db, batch.courseId);
  const lectures = batchLectures(db, batch.id);
  const used = new Set<ID>();
  let index = 0;
  const modules = (course?.modules || []).map((module) => ({
    module,
    rows: module.lectures.map((template) => {
      index++;
      const lecture = lectures.find((l) => !used.has(l.id) && l.title === template.title) || lectures.find((l) => !used.has(l.id) && l.number === index && !course?.modules.some((m) => m.lectures.some((t) => t.title === l.title)));
      if (lecture) used.add(lecture.id);
      return { template, lecture };
    }),
  }));
  return { modules, extra: lectures.filter((l) => !used.has(l.id)) };
}

/** Materials a student can open: courses of their batches with materials switched on. */
export function materialsForBatches(db: DB, batchIds: ID[]): Array<{ course: Course; materials: Material[] }> {
  const courseIds = new Set(batchIds.map((id) => getBatch(db, id)?.courseId).filter((x): x is ID => !!x));
  const out: Array<{ course: Course; materials: Material[] }> = [];
  for (const course of db.courses) {
    if (!courseIds.has(course.id) || !course.materialsEnabled) continue;
    const materials = db.materials.filter((m) => m.courseId === course.id);
    out.push({ course, materials });
  }
  return out;
}

export function canSeeMaterial(db: DB, studentId: ID | undefined, material: Material): boolean {
  const course = getCourse(db, material.courseId);
  if (!course?.materialsEnabled || !studentId) return false;
  return db.batches.some((b) => b.courseId === course.id && isInBatch(db, studentId, b.id));
}

/** Materials for the module a lecture belongs to, when the course has materials on. */
export function materialsForLecture(db: DB, lecture: Lecture): Material[] {
  const batch = getBatch(db, lecture.batchId);
  const course = getCourse(db, batch?.courseId);
  if (!course?.materialsEnabled) return [];
  const { module } = templateForLecture(course, lecture);
  if (!module) return [];
  return db.materials.filter((m) => m.courseId === course.id && m.moduleId === module.id);
}
