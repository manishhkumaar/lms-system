"use client";
import { useParams } from "@/lib/router";
import { getBatch, getCourse, getLecture } from "@/data/selectors";
import { isInBatch, materialsForLecture, templateForLecture } from "@/data/studentSelectors";
import { Banner, Card, EmptyState } from "@/design-system";
import { StudentPage } from "@/layouts/StudentLayout";
import { MaterialItem } from "./parts/Items";
import { StudentLiveCard } from "./parts/StudentLiveCard";
import { useMe } from "./parts/useMe";
import "./student.css";

export function LiveClassPage() {
  const { lectureId = "" } = useParams();
  const { db, studentId, tz } = useMe();
  const lecture = getLecture(db, lectureId);
  const batch = getBatch(db, lecture?.batchId);
  const course = getCourse(db, batch?.courseId);

  if (!lecture || !batch) {
    return (
      <StudentPage title="Live class" back={{ to: "/learn/timeline", label: "Lecture timeline" }}>
        <Card>
          <EmptyState icon="calendar" title="This lecture isn't available" description="It may have been removed. Check your lecture timeline for the current schedule." />
        </Card>
      </StudentPage>
    );
  }

  const enrolled = isInBatch(db, studentId, batch.id);
  const { module, template } = templateForLecture(course, lecture);
  const materials = enrolled ? materialsForLecture(db, lecture) : [];
  const agenda = lecture.agenda || template?.summary;

  return (
    <StudentPage title={lecture.title} subtitle={`${batch.name} · Lecture ${lecture.number}${module ? ` · ${module.title}` : ""}`} back={{ to: "/learn/timeline", label: "Lecture timeline" }}>
      {lecture.status === "cancelled" ? <Banner tone="danger">This lecture was cancelled. Your batch coordinator will share the new plan.</Banner> : null}
      {lecture.status === "rescheduled" ? <Banner tone="warning">This lecture was rescheduled. The time below is the new time.</Banner> : null}

      <div className="stu-live-wrap">
        <StudentLiveCard lecture={lecture} />

        <div className="stack-3">
          <Card title="Agenda">
            <p className="reading">{agenda || "Your instructor will share the agenda at the start of class."}</p>
            {lecture.instructor ? <p className="caption" style={{ marginTop: "var(--space-1)" }}>Instructor: {lecture.instructor}</p> : null}
          </Card>

          {enrolled ? (
            <Card title="Before you join">
              <ul className="stu-tips">
                <li>Join from a laptop if you can, so you can follow the code and slides.</li>
                <li>Use headphones and keep your microphone muted until you speak.</li>
                <li>Keep the meeting tab open for the whole class.</li>
              </ul>
            </Card>
          ) : null}

          <Banner tone="info">Clicking Join marks you as joined. Your attendance is confirmed after class by the meeting provider or your batch coordinator.</Banner>

          {materials.length ? (
            <Card title="Materials for this module" description={module?.title} flush>
              <ul className="list">
                {materials.map((m) => (
                  <li key={m.id}>
                    <MaterialItem material={m} tz={tz} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </StudentPage>
  );
}
