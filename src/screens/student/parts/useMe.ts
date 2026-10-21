import { useMemo } from "react";
import { useUser } from "@/auth/AuthContext";
import { useDb } from "@/data/store";
import { getBatch, getStudent } from "@/data/selectors";
import type { Batch, Enrolment } from "@/data/types";
import { DEFAULT_TZ } from "@/lib/time";
import { useNow } from "@/lib/useNow";

/** The signed-in student, their enrolments (active and completed) and batches, and the clock. */
export function useMe() {
  const user = useUser();
  const db = useDb();
  const now = useNow(15000);
  const studentId = user.studentId;
  const student = getStudent(db, studentId);
  const tz = user.timeZone || DEFAULT_TZ;

  const enrolments = useMemo<Enrolment[]>(
    () => (studentId ? db.enrolments.filter((e) => e.studentId === studentId && (e.status === "active" || e.status === "completed")) : []),
    [db.enrolments, studentId],
  );
  const batches = useMemo<Batch[]>(() => enrolments.map((e) => getBatch(db, e.batchId)).filter((b): b is Batch => !!b), [db, enrolments]);
  const batchIds = useMemo(() => batches.map((b) => b.id), [batches]);

  return { user, db, now, studentId, student, enrolments, batches, batchIds, tz };
}
