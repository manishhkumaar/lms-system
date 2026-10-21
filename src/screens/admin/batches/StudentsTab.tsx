import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EnrolDialog, TransferDialog } from "@/components/EnrolDialog";
import { useRun } from "@/components/useRun";
import { dropEnrolment } from "@/data/actions";
import { useDb } from "@/data/store";
import { activeEnrolments, getCourse, getStudent, studentAttendance, studentProgress, type AttendanceSummary, type BatchState } from "@/data/selectors";
import type { Batch, Enrolment, Student } from "@/data/types";
import { Button, DataTable, EmptyState, FilterBar, Menu, NameCell, Progress, SectionHeader, StatusChip, type Column } from "@/design-system";
import { formatDate, formatINR, plural, seatsLabel } from "@/lib/format";

interface Row {
  id: string;
  enrolment: Enrolment;
  student: Student;
  progress: number;
  att: AttendanceSummary;
}

function enrolBlocked(state: BatchState, batch: Batch): string | null {
  if (state === "draft") return "Open the batch for enrolment first.";
  if (state === "cancelled") return "This batch was cancelled.";
  if (state === "completed") return "This batch has finished.";
  if (state === "full") return `Full: all ${batch.capacity} seats are taken. Raise capacity in Edit batch.`;
  return null;
}

export function StudentsTab({ batch, state, now }: { batch: Batch; state: BatchState; now: number }) {
  const db = useDb();
  const user = useUser();
  const nav = useNavigate();
  const run = useRun();
  const [q, setQ] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [transfer, setTransfer] = useState<Enrolment | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const course = getCourse(db, batch.courseId);
  const canOpenStudent = canAccess(user.role, "students");

  const all = useMemo<Row[]>(
    () =>
      activeEnrolments(db, batch.id)
        .map((e) => {
          const student = getStudent(db, e.studentId);
          return student ? { id: e.id, enrolment: e, student, progress: studentProgress(db, e.studentId, batch.id), att: studentAttendance(db, e.studentId, batch.id, now) } : null;
        })
        .filter((r): r is Row => !!r)
        .sort((a, b) => a.student.name.localeCompare(b.student.name)),
    [db, batch.id, now],
  );
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? all.filter((r) => r.student.name.toLowerCase().includes(s) || r.student.email.toLowerCase().includes(s) || r.student.phone.includes(s)) : all;
  }, [all, q]);
  const left = db.enrolments.filter((e) => e.batchId === batch.id && (e.status === "transferred" || e.status === "dropped")).length;
  const blocked = enrolBlocked(state, batch);

  const columns: Column<Row>[] = [
    { key: "name", label: "Student", render: (r) => <NameCell name={r.student.name} sub={r.student.email} /> },
    { key: "status", label: "Status", render: (r) => <StatusChip status={r.enrolment.status === "completed" ? "completed" : "enrolled"} /> },
    { key: "enrolled", label: "Enrolled on", render: (r) => <span className="nowrap">{formatDate(r.enrolment.enrolledAt)}</span> },
    {
      key: "fee",
      label: "Fee paid",
      numeric: true,
      render: (r) => (
        <span>
          {formatINR(r.enrolment.feePaid)}
          {course && r.enrolment.feePaid < course.fee ? <span className="bl-cell-sub">{`of ${formatINR(course.fee)}`}</span> : null}
        </span>
      ),
    },
    {
      key: "progress",
      label: "Progress",
      width: 160,
      render: (r) => (
        <span className="acd-seats">
          <Progress value={r.progress} label={`${r.progress}% of lectures attended`} />
          <span>{r.progress}%</span>
        </span>
      ),
    },
    {
      key: "att",
      label: "Verified attendance",
      numeric: true,
      render: (r) => (r.att.held ? <span>{`${r.att.present}/${r.att.held} · ${Math.round(r.att.pct)}%`}</span> : "—"),
    },
    {
      key: "actions",
      label: <span className="visually-hidden">Actions</span>,
      width: 56,
      render: (r) => (
        <span className="acd-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Menu
            align="end"
            items={[
              ...(canOpenStudent ? [{ label: "Open profile", icon: "user" as const, onClick: () => nav(`/admin/students/${r.student.id}`) }] : []),
              { label: "Transfer student", icon: "transfer", disabled: r.enrolment.status !== "active", hint: r.enrolment.status !== "active" ? "Finished" : undefined, onClick: () => setTransfer(r.enrolment) },
              "separator",
              { label: "Remove from batch", icon: "trash", danger: true, disabled: r.enrolment.status !== "active", onClick: () => setRemoving(r) },
            ]}
            trigger={(p) => <Button variant="ghost" icon="more" className="acd-icon-btn" aria-label={`Actions for ${r.student.name}`} {...p} />}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="stack">
      <SectionHeader
        title="Students"
        description={`${seatsLabel(all.length, batch.capacity)}${left ? ` · ${plural(left, "student")} transferred out or dropped` : ""}`}
        actions={
          <>
            {blocked ? <span className="caption">{blocked}</span> : null}
            <Button icon="plus" disabled={!!blocked} onClick={() => setEnrolling(true)}>
              Enrol student
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={canOpenStudent ? (r) => nav(`/admin/students/${r.student.id}`) : undefined}
        toolbar={<FilterBar searchPlaceholder="Search students in this batch" searchValue={q} onSearch={setQ} />}
        footer={<span>{`Showing ${rows.length} of ${plural(all.length, "student")}`}</span>}
        empty={
          q.trim() ? (
            <EmptyState
              icon="search"
              title="No students match this search"
              action={
                <Button variant="secondary" onClick={() => setQ("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState icon="users" title="No students enrolled yet" description={blocked || "Enrol a selected lead or add a student directly."} />
          )
        }
      />
      <EnrolDialog open={enrolling} onClose={() => setEnrolling(false)} batchId={batch.id} />
      {transfer ? <TransferDialog open onClose={() => setTransfer(null)} enrolment={transfer} /> : null}
      <ConfirmDialog
        open={!!removing}
        title="Remove from batch"
        description={removing ? `Remove ${removing.student.name} from ${batch.code}? They lose access to live classes and recordings for this batch. Their verified attendance so far is kept.` : ""}
        confirmLabel="Remove student"
        cancelLabel="Keep student"
        onConfirm={() => {
          if (removing) void run(() => dropEnrolment(removing.enrolment.id), `${removing.student.name} removed from ${batch.code}`);
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
