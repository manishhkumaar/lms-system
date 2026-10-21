import { useMemo } from "react";
import { useNavigate } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { useDb } from "@/data/store";
import { attendanceStatus, batchLectures, batchStudents, isEnded, studentAttendance, type AttendanceStatus } from "@/data/selectors";
import type { Attendance, Batch, Lecture, Student } from "@/data/types";
import { Button, DataTable, EmptyState, SectionHeader, StatusChip, type Column } from "@/design-system";
import { formatDayMonth, formatRange24 } from "@/lib/format";
import { tzLabel } from "@/lib/time";

const COLS = 8;

const CELL: Record<AttendanceStatus, { short: string; label: string }> = {
  present: { short: "P", label: "Present, verified" },
  absent: { short: "A", label: "Absent" },
  joined: { short: "J", label: "Joined, not yet verified" },
  unverified: { short: "–", label: "Unverified" },
};

function Cell({ status }: { status: AttendanceStatus }) {
  return (
    <>
      <span className="visually-hidden">{CELL[status].label}</span>
      <span aria-hidden="true" title={CELL[status].label}>
        <StatusChip status={status} dot={false}>
          {CELL[status].short}
        </StatusChip>
      </span>
    </>
  );
}

interface Row extends Student {
  pct: number;
  present: number;
  held: number;
}

/** Students × the last 8 held lectures. Only verified presence counts; a Join click is not attendance. */
export function AttendanceTab({ batch, now }: { batch: Batch; now: number }) {
  const db = useDb();
  const user = useUser();
  const nav = useNavigate();

  const lectures = useMemo<Lecture[]>(() => batchLectures(db, batch.id).filter((l) => isEnded(l, now)).slice(-COLS), [db, batch.id, now]);
  const records = useMemo(() => {
    const ids = new Set(lectures.map((l) => l.id));
    const map = new Map<string, Attendance>();
    for (const a of db.attendance) if (ids.has(a.lectureId)) map.set(`${a.lectureId}|${a.studentId}`, a);
    return map;
  }, [db.attendance, lectures]);
  const rows = useMemo<Row[]>(
    () =>
      batchStudents(db, batch.id)
        .map((s) => {
          const sum = studentAttendance(db, s.id, batch.id, now);
          return { ...s, pct: sum.pct, present: sum.present, held: sum.held };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [db, batch.id, now],
  );

  const columns: Column<Row>[] = [
    { key: "name", label: "Student", render: (s) => <span className="nowrap">{s.name}</span> },
    ...lectures.map(
      (l): Column<Row> => ({
        key: l.id,
        label: (
          <span className="acd-lec-head" title={`${l.title} · ${formatDayMonth(l.start, l.timeZone)} ${formatRange24(l.start, l.end, l.timeZone)} ${tzLabel(l.timeZone, new Date(l.start))}`}>
            <span className="bl-mono">L{l.number}</span>
            <span>{formatDayMonth(l.start, l.timeZone)}</span>
          </span>
        ),
        render: (s) => <Cell status={attendanceStatus(records.get(`${l.id}|${s.id}`))} />,
      }),
    ),
    {
      key: "pct",
      label: "Verified attendance",
      numeric: true,
      render: (s) => (s.held ? <span className="nowrap">{`${Math.round(s.pct)}% · ${s.present}/${s.held}`}</span> : "—"),
    },
  ];

  return (
    <div className="stack">
      <SectionHeader
        title="Attendance"
        description={lectures.length ? `Last ${lectures.length} held lectures. All-time verified attendance on the right.` : undefined}
        actions={
          canAccess(user.role, "attendance") ? (
            <Button variant="secondary" icon="checklist" onClick={() => nav(`/admin/attendance?batch=${batch.id}`)}>
              Verify attendance
            </Button>
          ) : undefined
        }
      />
      <div className="acd-legend" aria-label="Legend">
        {(Object.keys(CELL) as AttendanceStatus[]).map((k) => (
          <span key={k}>
            <StatusChip status={k} dot={false}>
              {CELL[k].short}
            </StatusChip>
            {CELL[k].label}
          </span>
        ))}
        <span>Joined is not attendance: only verified presence counts.</span>
      </div>
      {lectures.length ? (
        <div className="acd-matrix">
          <DataTable columns={columns} rows={rows} empty={<EmptyState icon="users" title="No students enrolled" />} />
        </div>
      ) : (
        <div className="bl-card">
          <EmptyState icon="checklist" title="No lectures held yet" description="Attendance appears here after the first lecture ends and is verified." />
        </div>
      )}
    </div>
  );
}
