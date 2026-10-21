"use client";
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { BatchChip } from "@/components/StatusChips";
import { useRun } from "@/components/useRun";
import { updateCourse } from "@/data/actions";
import { useDb } from "@/data/store";
import { getUser, seatsFilled } from "@/data/selectors";
import type { Batch } from "@/data/types";
import { Banner, Button, Card, DataTable, EmptyState, MetaList, NameCell, Progress, Tabs, type Column } from "@/design-system";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { formatDate, formatDuration, formatINR, formatRelative, plural } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { datesLabel, scheduleLabel } from "./batches/batchFormat";
import { CourseStatusChip, MaterialsChip, templateCount, templateMinutes } from "./courses/courseBits";
import { CurriculumTab } from "./courses/CurriculumTab";
import { DetailsTab } from "./courses/DetailsTab";
import { MaterialsTab } from "./courses/MaterialsTab";
import "./academics.css";

/** Course Editor: curriculum, details, materials and the batches that deliver it. */
export function CourseEditorPage() {
  const { courseId = "" } = useParams();
  const db = useDb();
  const user = useUser();
  const nav = useNavigate();
  const now = useNow(60000);
  const run = useRun();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "curriculum";
  const course = db.courses.find((c) => c.id === courseId);

  const batches = useMemo(() => db.batches.filter((b) => b.courseId === courseId).sort((a, b) => b.startDate.localeCompare(a.startDate)), [db.batches, courseId]);
  const materialsCount = useMemo(() => db.materials.filter((m) => m.courseId === courseId).length, [db.materials, courseId]);

  if (!course) {
    return (
      <AdminPage title="Course not found" breadcrumb={<Crumbs items={[{ label: "Courses", to: "/admin/courses" }]} />}>
        <div className="bl-card">
          <EmptyState
            icon="book"
            title="This course doesn't exist"
            description="It may have been removed, or the link is wrong."
            action={
              <Button variant="secondary" onClick={() => nav("/admin/courses")}>
                Back to courses
              </Button>
            }
          />
        </div>
      </AdminPage>
    );
  }

  const lectures = templateCount(course);
  const canPublish = lectures > 0;
  const canOpenBatches = canAccess(user.role, "batches");

  const actions =
    course.status === "draft" ? (
      <Button icon="check" disabled={!canPublish} title={canPublish ? undefined : "Add at least one lecture before publishing"} onClick={() => void run(() => updateCourse(course.id, { status: "published" }), "Course published", "Operations can now schedule batches of it.")}>
        Publish course
      </Button>
    ) : (
      <Button
        variant="secondary"
        onClick={() =>
          void run(() => updateCourse(course.id, { status: "draft" }), "Moved to draft", batches.length ? "Existing batches carry on. New batches can't be created until you publish again." : "New batches can't be created until you publish again.")
        }
      >
        Move to draft
      </Button>
    );

  const batchColumns: Column<Batch>[] = [
    { key: "name", label: "Batch", render: (b) => <NameCell name={b.name} sub={<span className="bl-mono">{b.code}</span>} /> },
    { key: "dates", label: "Dates", render: (b) => <span className="nowrap">{datesLabel(b)}</span> },
    { key: "schedule", label: "Schedule", render: (b) => <span className="nowrap">{scheduleLabel(b)}</span> },
    {
      key: "seats",
      label: "Seats",
      render: (b) => {
        const filled = seatsFilled(db, b.id);
        return (
          <span className="acd-seats">
            <Progress value={(filled / b.capacity) * 100} label={`${filled} of ${b.capacity} seats filled`} />
            <span>
              {filled} of {b.capacity}
            </span>
          </span>
        );
      },
    },
    { key: "status", label: "Status", render: (b) => <BatchChip batch={b} now={now} /> },
  ];

  const designer = getUser(db, course.designerId);

  return (
    <AdminPage title={course.title} breadcrumb={<Crumbs items={[{ label: "Courses", to: "/admin/courses" }, { label: course.code }]} />} actions={actions}>
      <Card>
        <div className="stack">
          <div className="row">
            <CourseStatusChip course={course} />
            <MaterialsChip on={course.materialsEnabled} />
          </div>
          <p className="muted reading">{course.summary}</p>
          <MetaList
            columns={4}
            items={[
              { label: "Code", value: course.code, mono: true },
              { label: "Level", value: course.level },
              { label: "Lectures", value: `${plural(lectures, "lecture")} · ${formatDuration(templateMinutes(course))}` },
              { label: "Duration", value: plural(course.durationWeeks, "week") },
              { label: "Fee", value: formatINR(course.fee) },
              { label: "Batches", value: plural(batches.length, "batch", "batches") },
              { label: "Course designer", value: designer?.name || "—" },
              { label: "Last updated", value: `${formatRelative(course.updatedAt, now)}` },
            ]}
          />
        </div>
      </Card>

      {course.status === "draft" && !canPublish ? (
        <Banner tone="warning" title="Add at least one lecture before publishing">
          Publishing makes the course available for Operations to schedule batches. Add modules and their lecture templates in Curriculum first.
        </Banner>
      ) : null}

      <Tabs
        value={tab}
        onChange={(v) => setParams(v === "curriculum" ? {} : { tab: v }, { replace: true })}
        items={[
          { value: "curriculum", label: "Curriculum", count: lectures },
          { value: "details", label: "Details" },
          { value: "materials", label: "Materials", count: materialsCount },
          { value: "batches", label: "Batches", count: batches.length },
        ]}
      />

      {tab === "curriculum" ? <CurriculumTab course={course} /> : null}
      {tab === "details" ? <DetailsTab course={course} hasBatches={batches.length > 0} /> : null}
      {tab === "materials" ? <MaterialsTab course={course} /> : null}
      {tab === "batches" ? (
        <div className="stack">
          {!canOpenBatches ? <p className="caption">Operations schedules and runs batches. You can see them here; batch details are managed in Batch Management.</p> : null}
          <DataTable
            columns={batchColumns}
            rows={batches}
            onRowClick={canOpenBatches ? (b) => nav(`/admin/batches/${b.id}`) : undefined}
            empty={
              <EmptyState
                icon="layers"
                title="No batches of this course yet"
                description={course.status === "published" ? "Operations creates batches: one scheduled delivery with dates, seats and instructors." : "Publish the course first. Operations can then schedule batches of it."}
                action={
                  canOpenBatches && course.status === "published" ? (
                    <Button variant="secondary" icon="plus" onClick={() => nav(`/admin/batches/new?course=${course.id}`)}>
                      New batch
                    </Button>
                  ) : undefined
                }
              />
            }
            footer={batches.length ? <span>{`${plural(batches.length, "batch", "batches")} · earliest starts ${formatDate(batches[batches.length - 1].startDate)}`}</span> : undefined}
          />
        </div>
      ) : null}
    </AdminPage>
  );
}
