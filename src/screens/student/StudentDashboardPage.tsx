"use client";
import { useMemo } from "react";
import { Link } from "@/lib/router";
import { BatchChip } from "@/components/StatusChips";
import { getCourse, isLive, lastEndedLectureForStudent, nextLectureForStudent, studentAttendance, studentProgress } from "@/data/selectors";
import { lecturesForBatches, recordingsForBatches } from "@/data/studentSelectors";
import { Card, EmptyState, Icon, MetaList, Progress } from "@/design-system";
import { firstName, formatDate, formatWhen, greeting } from "@/lib/format";
import { dateKey } from "@/lib/time";
import { StudentPage } from "@/layouts/StudentLayout";
import { LectureRow, RecordingItem } from "./parts/Items";
import { StudentLiveCard } from "./parts/StudentLiveCard";
import { useMe } from "./parts/useMe";
import { scheduleLabel, startsIn } from "./parts/util";
import "./student.css";

const WEEK = 7 * 86400000;

export function StudentDashboardPage() {
  const { user, db, now, studentId, enrolments, batches, batchIds, tz } = useMe();
  const today = dateKey(new Date(now), tz);

  const active = useMemo(() => batches.filter((b) => enrolments.some((e) => e.batchId === b.id && e.status === "active")), [batches, enrolments]);
  const completed = useMemo(() => batches.filter((b) => enrolments.some((e) => e.batchId === b.id && e.status === "completed")), [batches, enrolments]);
  const upcomingOnly = active.length > 0 && active.every((b) => b.startDate > today);

  const next = studentId ? nextLectureForStudent(db, studentId, now) : undefined;
  const last = studentId ? lastEndedLectureForStudent(db, studentId, now) : undefined;
  const cardLecture = next || last;
  const liveNow = !!next && isLive(next, now);

  const thisWeek = useMemo(
    () =>
      lecturesForBatches(
        db,
        active.map((b) => b.id),
      ).filter((l) => l.status !== "cancelled" && new Date(l.end).getTime() > now && new Date(l.start).getTime() - now < WEEK),
    [db, active, now],
  );
  const recordings = useMemo(() => recordingsForBatches(db, batchIds).slice(0, 3), [db, batchIds]);

  let status: string;
  if (!batches.length) status = "Once you're enrolled in a batch, your classes and recordings appear here.";
  else if (liveNow) status = "Your class is live now.";
  else if (upcomingOnly) status = `Your batch starts on ${formatDate(active.slice().sort((a, b) => a.startDate.localeCompare(b.startDate))[0].startDate)}.`;
  else if (next && new Date(next.start).getTime() - now < WEEK) status = `Your next class starts ${startsIn(new Date(next.start).getTime(), now, tz)}.`;
  else if (!active.length && completed.length) status = `You've completed ${completed.map((b) => b.name).join(" and ")}.`;
  else status = "No classes scheduled this week.";

  const hero = (
    <div className="stu-hero">
      <p className="t-display">{`${greeting(tz, new Date(now))}, ${firstName(user.name)}`}</p>
      <p className="stu-hero-status">{status}</p>
    </div>
  );

  if (!batches.length) {
    return (
      <StudentPage title="Home" hideTitle>
        {hero}
        <Card>
          <EmptyState
            icon="graduation"
            title="You're not in a batch yet"
            description={
              <>
                Your admissions advisor enrols you in a batch once your seat is confirmed. Questions? Write to <a href={`mailto:${db.settings.supportEmail}`}>{db.settings.supportEmail}</a>.
              </>
            }
          />
        </Card>
      </StudentPage>
    );
  }

  return (
    <StudentPage title="Home" hideTitle>
      {hero}

      <div className="stu-dash">
        <div className="stu-col">
          {cardLecture ? <StudentLiveCard lecture={cardLecture} /> : null}

          {upcomingOnly
            ? active.map((b) => {
                const first = lecturesForBatches(db, [b.id])[0];
                return (
                  <Card key={b.id} title={`Your batch starts on ${formatDate(b.startDate)}`} description={b.name}>
                    <MetaList
                      columns={1}
                      items={[
                        { label: "Schedule", value: scheduleLabel(b, tz) },
                        { label: "First lecture", value: first ? `${first.title} · ${formatWhen(first.start, first.end, tz)}` : "To be scheduled" },
                        { label: "Instructors", value: b.instructors.join(", ") || "To be announced" },
                      ]}
                    />
                  </Card>
                );
              })
            : null}

          {!active.length && completed.length
            ? completed.map((b) => (
                <Card key={b.id} title={`You've completed ${b.name}`} description={getCourse(db, b.courseId)?.title}>
                  <div className="stack-1">
                    <span className="muted">Your recordings stay available, so you can revisit any lecture.</span>
                    <Link to="/learn/recordings" className="bl-btn bl-btn-secondary bl-btn-touch stu-action">
                      <Icon name="video" />
                      Watch recordings
                    </Link>
                  </div>
                </Card>
              ))
            : null}
        </div>

        <div className="stu-col">
          {active.length ? (
            <Card title="This week" flush actions={<Link to="/learn/timeline">Lecture timeline</Link>}>
              {thisWeek.length ? (
                <ul className="list">
                  {thisWeek.map((l) => (
                    <li key={l.id}>
                      <LectureRow db={db} lecture={l} now={now} tz={tz} showBatch={active.length > 1} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon="calendar" title="No classes scheduled this week" description="Your next lectures will appear here once they're scheduled." />
              )}
            </Card>
          ) : null}

          {recordings.length ? (
            <Card title="Latest recordings" flush actions={<Link to="/learn/recordings">All recordings</Link>}>
              <ul className="list">
                {recordings.map((r) => (
                  <li key={r.recording.id}>
                    <RecordingItem recording={r.recording} lecture={r.lecture} batch={r.batch} tz={tz} showBatch={batches.length > 1} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {batches.map((b) => {
            const course = getCourse(db, b.courseId);
            const att = studentId ? studentAttendance(db, studentId, b.id, now) : undefined;
            const progress = studentId ? studentProgress(db, studentId, b.id) : 0;
            return (
              <Card key={b.id} title={course?.title} description={b.name} actions={<BatchChip batch={b} now={now} />}>
                <div className="stack-1">
                  <div className="stu-progress">
                    <Progress value={progress} label={`Progress in ${b.name}`} />
                    <span>{progress}%</span>
                  </div>
                  <span className="caption">
                    {att && att.held ? `Verified attendance ${att.present} of ${att.held} lectures` : "Verified attendance starts after your first lecture"}
                  </span>
                  <Link to={`/learn/courses/${b.id}`}>Open course</Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </StudentPage>
  );
}
