"use client";
import { Link } from "@/lib/router";
import { BatchChip } from "@/components/StatusChips";
import { getCourse, studentProgress } from "@/data/selectors";
import { lecturesForBatches } from "@/data/studentSelectors";
import { Card, EmptyState, Progress } from "@/design-system";
import { formatDate, formatWhen } from "@/lib/format";
import { StudentPage } from "@/layouts/StudentLayout";
import { useMe } from "./parts/useMe";
import { scheduleLabel } from "./parts/util";
import "./student.css";

export function MyCoursesPage() {
  const { db, now, studentId, batches, tz } = useMe();

  return (
    <StudentPage title="My courses" subtitle="Each course is delivered to you through your batch.">
      {batches.length ? (
        <div className="stu-cards">
          {batches.map((b) => {
            const course = getCourse(db, b.courseId);
            const progress = studentId ? studentProgress(db, studentId, b.id) : 0;
            const next = lecturesForBatches(db, [b.id]).find((l) => l.status !== "cancelled" && new Date(l.end).getTime() > now);
            return (
              <Link key={b.id} to={`/learn/courses/${b.id}`} className="bl-card stu-course">
                <div className="stu-course-top">
                  <BatchChip batch={b} now={now} />
                  <span className="stu-course-code">{b.code}</span>
                </div>
                <div>
                  <h2 className="t-h3">{course?.title}</h2>
                  <div className="muted">{b.name}</div>
                </div>
                <div className="caption">
                  {formatDate(b.startDate)} – {formatDate(b.endDate)} · {scheduleLabel(b, tz)}
                </div>
                <div className="stu-progress">
                  <Progress value={progress} label="Course progress" />
                  <span>{progress}%</span>
                </div>
                {next ? (
                  <div className="stu-next">
                    <strong>Next: {next.title}</strong>
                    <span className="bl-mono">{formatWhen(next.start, next.end, tz)}</span>
                  </div>
                ) : (
                  <div className="stu-next">
                    <strong>All lectures are done</strong>
                    Recordings stay available.
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon="book" title="You're not in a batch yet" description="Your courses appear here once you're enrolled in a batch." />
        </Card>
      )}
    </StudentPage>
  );
}
