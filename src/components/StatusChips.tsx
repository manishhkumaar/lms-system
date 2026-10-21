import { useDb } from "@/data/store";
import { attendanceStatus, batchStateIn, lectureStateIn } from "@/data/selectors";
import type { Attendance, Batch, Lecture } from "@/data/types";
import { StatusChip } from "@/design-system";
import { useNow } from "@/lib/useNow";

/** A lecture's derived state: Scheduled, Link not published, Live, Ended, Recording pending/ready… */
export function LectureChip({ lecture, now }: { lecture: Lecture; now?: number }) {
  const db = useDb();
  const tick = useNow(15000);
  return <StatusChip status={lectureStateIn(db, lecture, now ?? tick)} />;
}

/** A batch's derived state: Draft, Upcoming, Full, Ongoing, Completed, Cancelled. */
export function BatchChip({ batch, now }: { batch: Batch; now?: number }) {
  const db = useDb();
  const tick = useNow(60000);
  return <StatusChip status={batchStateIn(db, batch, now ?? tick)} />;
}

/** Joined ≠ attended: Present · verified / Absent / Joined / Unverified. */
export function AttendanceChip({ record }: { record: Attendance | undefined }) {
  return <StatusChip status={attendanceStatus(record)} />;
}
