/* Directory rows: each student's batches, status, progress and verified attendance, computed with indexes. */
import { batchStateIn, isEnded, type BatchState } from "@/data/selectors";
import type { Attendance, Batch, DB, Enrolment, ID, Lecture, Student } from "@/data/types";

export type DirectoryStatus = "enrolled" | "upcoming" | "completed" | "none";

export const DIRECTORY_STATUS_LABEL: Record<DirectoryStatus, string> = {
  enrolled: "Enrolled",
  upcoming: "Upcoming",
  completed: "Completed",
  none: "Not enrolled",
};

export interface StudentRow {
  id: ID;
  student: Student;
  batches: Batch[];
  status: DirectoryStatus;
  /** The batch progress and attendance are shown for. */
  primary?: Batch;
  progress: number;
  present: number;
  held: number;
}

export function buildStudentRows(db: DB, now: number): StudentRow[] {
  const lecturesByBatch = new Map<ID, Lecture[]>();
  for (const l of db.lectures) {
    if (l.status === "cancelled") continue;
    lecturesByBatch.set(l.batchId, [...(lecturesByBatch.get(l.batchId) || []), l]);
  }
  const att = new Map<string, Attendance>();
  for (const a of db.attendance) att.set(`${a.lectureId}|${a.studentId}`, a);
  const enrByStudent = new Map<ID, Enrolment[]>();
  for (const e of db.enrolments) enrByStudent.set(e.studentId, [...(enrByStudent.get(e.studentId) || []), e]);
  const batchById = new Map(db.batches.map((b) => [b.id, b]));
  const stateById = new Map<ID, BatchState>(db.batches.map((b) => [b.id, batchStateIn(db, b, now)]));

  return db.students.map((s) => {
    const ens = (enrByStudent.get(s.id) || []).filter((e) => e.status === "active" || e.status === "completed");
    const batches = ens.map((e) => batchById.get(e.batchId)).filter((b): b is Batch => !!b);
    const live = ens.filter((e) => e.status === "active");
    const ongoing = live.find((e) => stateById.get(e.batchId) === "ongoing");
    const upcoming = live.find((e) => ["upcoming", "full", "draft"].includes(stateById.get(e.batchId) || ""));
    const done = ens.find((e) => e.status === "completed" || stateById.get(e.batchId) === "completed");
    const status: DirectoryStatus = ongoing ? "enrolled" : upcoming ? "upcoming" : done ? "completed" : "none";
    const primaryId = (ongoing || upcoming || done)?.batchId;
    const primary = primaryId ? batchById.get(primaryId) : undefined;
    let present = 0;
    let held = 0;
    let planned = 0;
    if (primary) {
      for (const l of lecturesByBatch.get(primary.id) || []) {
        planned++;
        const isPresent = att.get(`${l.id}|${s.id}`)?.verification === "present";
        if (isPresent) present++;
        if (isEnded(l, now)) held++;
      }
    }
    return { id: s.id, student: s, batches, status, primary, progress: planned ? Math.round((present / planned) * 100) : 0, present, held };
  });
}

export function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
