"use client";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ScheduleLectureDialog } from "@/components/ScheduleLectureDialog";
import { useRun } from "@/components/useRun";
import { cancelBatch, openBatchForEnrolment } from "@/data/actions";
import { useDb } from "@/data/store";
import { activeEnrolments, batchLectures, batchStateIn, getBatch, getCourse, getUser, seatsFilled } from "@/data/selectors";
import { Banner, Button, Card, EmptyState, Menu, MetaList, Progress, StatusChip, Tabs } from "@/design-system";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { formatDate, plural, seatsLabel } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { AttendanceTab } from "./batches/AttendanceTab";
import { datesLabel, scheduleLabel } from "./batches/batchFormat";
import { EditBatchDialog } from "./batches/EditBatchDialog";
import { LecturesTab } from "./batches/LecturesTab";
import { OverviewTab } from "./batches/OverviewTab";
import { RecordingsTab } from "./batches/RecordingsTab";
import { StudentsTab } from "./batches/StudentsTab";
import "./academics.css";

/** Batch Details: one scheduled delivery of a course, its students, lectures, recordings and attendance. */
export function BatchDetailsPage() {
  const { batchId = "" } = useParams();
  const db = useDb();
  const user = useUser();
  const nav = useNavigate();
  const now = useNow(15000);
  const run = useRun();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const batch = getBatch(db, batchId);
  const counts = useMemo(
    () =>
      batch
        ? {
            students: activeEnrolments(db, batch.id).length,
            lectures: batchLectures(db, batch.id).length,
            upcoming: batchLectures(db, batch.id).filter((l) => l.status !== "cancelled" && new Date(l.start).getTime() > now).length,
            recordings: db.recordings.filter((r) => r.batchId === batch.id).length,
          }
        : { students: 0, lectures: 0, upcoming: 0, recordings: 0 },
    [db, batch, now],
  );

  if (!batch) {
    return (
      <AdminPage title="Batch not found" breadcrumb={<Crumbs items={[{ label: "Batches", to: "/admin/batches" }]} />}>
        <div className="bl-card">
          <EmptyState
            icon="layers"
            title="This batch doesn't exist"
            description="It may have been removed, or the link is wrong."
            action={
              <Button variant="secondary" onClick={() => nav("/admin/batches")}>
                Back to batches
              </Button>
            }
          />
        </div>
      </AdminPage>
    );
  }

  const course = getCourse(db, batch.courseId);
  const state = batchStateIn(db, batch, now);
  const filled = seatsFilled(db, batch.id);
  const closed = state === "cancelled" || state === "completed";
  const owner = getUser(db, batch.ownerId);
  const setTab = (v: string) => setParams(v === "overview" ? {} : { tab: v }, { replace: true });

  const actions = (
    <>
      <Menu
        align="end"
        items={[
          { label: "Edit batch", icon: "edit", disabled: state === "cancelled", onClick: () => setEditing(true) },
          ...(batch.lifecycle === "draft" ? [{ label: "Open for enrolment", icon: "check" as const, onClick: () => void run(() => openBatchForEnrolment(batch.id), `${batch.code} is open for enrolment`, "Admissions can now enrol students.") }] : []),
          "separator",
          { label: "Cancel batch", icon: "x", danger: true, disabled: closed, hint: state === "completed" ? "Finished" : state === "cancelled" ? "Cancelled" : undefined, onClick: () => setCancelling(true) },
        ]}
        trigger={(p) => (
          <Button variant="secondary" iconRight="chevronDown" {...p}>
            More
          </Button>
        )}
      />
      <Button icon="plus" disabled={closed} title={closed ? `This batch is ${state}` : undefined} onClick={() => setScheduling(true)}>
        Schedule lecture
      </Button>
    </>
  );

  return (
    <AdminPage title={batch.name} breadcrumb={<Crumbs items={[{ label: "Batches", to: "/admin/batches" }, { label: batch.code }]} />} actions={actions}>
      <Card>
        <MetaList
          columns={4}
          items={[
            { label: "Course", value: course ? canAccess(user.role, "courses") ? <Link to={`/admin/courses/${course.id}`}>{course.title}</Link> : course.title : "—" },
            { label: "Batch code", value: batch.code, mono: true },
            { label: "Status", value: <StatusChip status={state} /> },
            {
              label: "Seats",
              value: (
                <span className="stack-1">
                  <span>{seatsLabel(filled, batch.capacity)}</span>
                  <Progress value={(filled / batch.capacity) * 100} label={seatsLabel(filled, batch.capacity)} />
                </span>
              ),
            },
            { label: "Dates", value: datesLabel(batch) },
            { label: "Schedule", value: scheduleLabel(batch) },
            { label: "Instructors", value: batch.instructors.length ? batch.instructors.join(", ") : "Not assigned" },
            { label: "Operations owner", value: owner?.name || "—" },
          ]}
        />
      </Card>

      {state === "draft" ? (
        <Banner
          tone="info"
          title="Draft: not open for enrolment"
          action={
            <Button variant="secondary" onClick={() => void run(() => openBatchForEnrolment(batch.id), `${batch.code} is open for enrolment`, "Admissions can now enrol students.")}>
              Open for enrolment
            </Button>
          }
        >
          Admissions can't enrol students until you open it. You can still schedule lectures.
        </Banner>
      ) : null}
      {state === "full" ? (
        <Banner tone="warning" title={`Full: ${seatsLabel(filled, batch.capacity)}`}>
          Raise capacity in Edit batch to enrol more students, or enrol them in another batch.
        </Banner>
      ) : null}
      {state === "cancelled" ? (
        <Banner tone="danger" title="This batch was cancelled">
          Scheduling and enrolment are closed. Recordings and attendance are kept.
        </Banner>
      ) : null}
      {state === "completed" ? (
        <Banner tone="neutral" title={`This batch finished on ${formatDate(batch.endDate)}`}>
          Scheduling is closed. Recordings stay available to its students.
        </Banner>
      ) : null}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Overview" },
          { value: "students", label: "Students", count: counts.students },
          { value: "lectures", label: "Lectures", count: counts.lectures },
          { value: "recordings", label: "Recordings", count: counts.recordings },
          { value: "attendance", label: "Attendance" },
        ]}
      />

      {tab === "overview" ? <OverviewTab batch={batch} now={now} onTab={setTab} /> : null}
      {tab === "students" ? <StudentsTab batch={batch} state={state} now={now} /> : null}
      {tab === "lectures" ? <LecturesTab batch={batch} now={now} onSchedule={() => setScheduling(true)} /> : null}
      {tab === "recordings" ? <RecordingsTab batch={batch} now={now} /> : null}
      {tab === "attendance" ? <AttendanceTab batch={batch} now={now} /> : null}

      <ScheduleLectureDialog open={scheduling} onClose={() => setScheduling(false)} batchId={batch.id} />
      <EditBatchDialog open={editing} onClose={() => setEditing(false)} batch={batch} />
      <ConfirmDialog
        open={cancelling}
        title="Cancel batch"
        description={`Cancel ${batch.code}? ${plural(filled, "student")} will be notified and ${plural(counts.upcoming, "upcoming lecture")} cancelled.`}
        confirmLabel="Cancel batch"
        cancelLabel="Keep batch"
        onConfirm={() => void run(() => cancelBatch(batch.id), `${batch.code} cancelled`, `${plural(filled, "student")} will be notified.`)}
        onClose={() => setCancelling(false)}
      />
    </AdminPage>
  );
}
