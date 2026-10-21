"use client";
import { useMemo, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { BatchChip } from "@/components/StatusChips";
import { getBatch, getCourse, studentAttendance, studentProgress } from "@/data/selectors";
import { curriculumForBatch, isInBatch } from "@/data/studentSelectors";
import { Card, EmptyState, MetaList, Progress, Tabs } from "@/design-system";
import { formatDate, plural } from "@/lib/format";
import { StudentPage } from "@/layouts/StudentLayout";
import { LectureRow, MaterialItem } from "./parts/Items";
import { useMe } from "./parts/useMe";
import { scheduleLabel } from "./parts/util";
import "./student.css";

export function CourseOverviewPage() {
  const { batchId = "" } = useParams();
  const { db, now, studentId, tz } = useMe();
  const batch = getBatch(db, batchId);
  const course = getCourse(db, batch?.courseId);
  const allowed = !!batch && isInBatch(db, studentId, batch.id);
  const [tab, setTab] = useState("curriculum");

  const curriculum = useMemo(() => (batch && allowed ? curriculumForBatch(db, batch) : { modules: [], extra: [] }), [db, batch, allowed]);
  const materials = useMemo(() => (course?.materialsEnabled ? db.materials.filter((m) => m.courseId === course.id) : []), [db.materials, course]);

  if (!batch || !course || !allowed) {
    return (
      <StudentPage title="Course" back={{ to: "/learn/courses", label: "My courses" }}>
        <Card>
          <EmptyState
            icon="lock"
            title="Only students in this batch can see this course"
            description="If you think you should have access, contact your batch coordinator."
            action={
              <Link to="/learn/courses" className="bl-btn bl-btn-secondary bl-btn-touch stu-action">
                Go to my courses
              </Link>
            }
          />
        </Card>
      </StudentPage>
    );
  }

  const att = studentId ? studentAttendance(db, studentId, batch.id, now) : undefined;
  const progress = studentId ? studentProgress(db, studentId, batch.id) : 0;
  const tabs = [
    { value: "curriculum", label: "Curriculum", count: course.modules.reduce((n, m) => n + m.lectures.length, 0) },
    ...(course.materialsEnabled ? [{ value: "materials", label: "Materials", count: materials.length }] : []),
    { value: "about", label: "About" },
  ];
  const current = tabs.some((t) => t.value === tab) ? tab : "curriculum";
  const moduleTitle = (id?: string) => course.modules.find((m) => m.id === id)?.title;

  return (
    <StudentPage title={course.title} subtitle={`${batch.name} · ${batch.code}`} back={{ to: "/learn/courses", label: "My courses" }} actions={<BatchChip batch={batch} now={now} />}>
      <Card>
        <div className="stack">
          <MetaList
            items={[
              { label: "Schedule", value: scheduleLabel(batch, tz) },
              { label: "Dates", value: `${formatDate(batch.startDate)} – ${formatDate(batch.endDate)}` },
              { label: "Instructors", value: batch.instructors.join(", ") || "To be announced" },
              { label: "Verified attendance", value: att && att.held ? `${att.present} of ${plural(att.held, "lecture")}` : "Starts after your first lecture" },
            ]}
          />
          <div className="stu-progress">
            <Progress value={progress} label="Course progress" />
            <span>{progress}%</span>
          </div>
        </div>
      </Card>

      <Tabs items={tabs} value={current} onChange={setTab} />

      {current === "curriculum" ? (
        <div className="bl-card">
          {curriculum.modules.map(({ module, rows }, mi) => (
            <section key={module.id} className="stu-module" aria-label={module.title}>
              <div className="stu-module-head">
                <h3>{module.title}</h3>
                <span>Module {mi + 1} · {plural(rows.length, "lecture")}</span>
              </div>
              <ul className="list">
                {rows.map(({ template, lecture }) => (
                  <li key={template.id}>
                    {lecture ? (
                      <LectureRow db={db} lecture={lecture} now={now} tz={tz} showBatch={false} />
                    ) : (
                      <div className="stu-unsched">
                        <span className="bl-mono stu-lecture-num">–</span>
                        <span style={{ flex: 1 }}>{template.title}</span>
                        <span className="caption">Not scheduled yet</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {curriculum.extra.length ? (
            <section className="stu-module" aria-label="Additional sessions">
              <div className="stu-module-head">
                <h3>Additional sessions</h3>
              </div>
              <ul className="list">
                {curriculum.extra.map((l) => (
                  <li key={l.id}>
                    <LectureRow db={db} lecture={l} now={now} tz={tz} showBatch={false} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {!curriculum.modules.length && !curriculum.extra.length ? <EmptyState icon="book" title="The curriculum is being prepared" description="Lectures appear here once your course designer publishes them." /> : null}
        </div>
      ) : null}

      {current === "materials" ? (
        <Card flush>
          {materials.length ? (
            <ul className="list">
              {materials.map((m) => (
                <li key={m.id}>
                  <MaterialItem material={m} moduleTitle={moduleTitle(m.moduleId)} tz={tz} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="file" title="No materials yet" description="Notes, slides and links for this course appear here once they're added." />
          )}
        </Card>
      ) : null}

      {current === "about" ? (
        <Card title="About this course">
          <div className="stack reading">
            <p>{course.summary}</p>
            <MetaList
              items={[
                { label: "Level", value: course.level },
                { label: "Duration", value: plural(course.durationWeeks, "week") },
                { label: "Modules", value: course.modules.length },
                { label: "Your batch", value: `${batch.name} (${batch.code})` },
              ]}
            />
          </div>
        </Card>
      ) : null}
    </StudentPage>
  );
}
