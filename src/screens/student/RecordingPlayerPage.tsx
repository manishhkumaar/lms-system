"use client";
import { useMemo } from "react";
import { Link, useParams } from "@/lib/router";
import { RecordingPlayer } from "@/components/RecordingPlayer";
import { recordView } from "@/data/actions";
import { getBatch, getCourse, getLecture, getRecording } from "@/data/selectors";
import { isInBatch, materialsForLecture, recordingsForBatches, templateForLecture } from "@/data/studentSelectors";
import { Card, EmptyState, Icon, MetaList } from "@/design-system";
import { formatDuration, formatWhen } from "@/lib/format";
import { StudentPage } from "@/layouts/StudentLayout";
import { MaterialItem } from "./parts/Items";
import { useMe } from "./parts/useMe";
import "./student.css";

export function RecordingPlayerPage() {
  const { recordingId = "" } = useParams();
  const { db, studentId, tz } = useMe();
  const recording = getRecording(db, recordingId);
  const lecture = getLecture(db, recording?.lectureId);
  const batch = getBatch(db, recording?.batchId);
  const course = getCourse(db, batch?.courseId);
  const back = { to: "/learn/recordings", label: "Recordings" };
  const allowed = !!recording && !!lecture && !!batch && recording.status === "ready" && recording.published && isInBatch(db, studentId, batch.id);

  // Available recordings of this batch, in lecture order.
  const siblings = useMemo(() => (batch ? recordingsForBatches(db, [batch.id]).slice().reverse() : []), [db, batch]);

  if (!allowed) {
    return (
      <StudentPage title="Recording" back={back}>
        <Card>
          <EmptyState
            icon="video"
            title="This recording isn't available"
            description="Recordings are shared with students in the lecture's batch once they're processed and published."
            action={
              <Link to="/learn/recordings" className="bl-btn bl-btn-secondary bl-btn-touch stu-action">
                Go to recordings
              </Link>
            }
          />
        </Card>
      </StudentPage>
    );
  }

  const i = siblings.findIndex((s) => s.recording.id === recording.id);
  const prev = i > 0 ? siblings[i - 1] : undefined;
  const next = i >= 0 && i < siblings.length - 1 ? siblings[i + 1] : undefined;
  const { module } = templateForLecture(course, lecture);
  const materials = materialsForLecture(db, lecture);

  return (
    <StudentPage title={recording.title} subtitle={`${batch.name} · Lecture ${lecture.number}`} back={back}>
      <RecordingPlayer key={recording.id} recording={recording} onPlay={() => void recordView(recording.id).catch(() => undefined)} />

      <div className="stu-player-nav">
        {prev ? (
          <Link to={`/learn/recordings/${prev.recording.id}`} className="bl-btn bl-btn-secondary bl-btn-touch">
            <Icon name="chevronLeft" />
            Previous lecture
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/learn/recordings/${next.recording.id}`} className="bl-btn bl-btn-secondary bl-btn-touch">
            Next lecture
            <Icon name="chevronRight" />
          </Link>
        ) : null}
      </div>

      <Card title="About this lecture">
        <MetaList
          items={[
            { label: "Class held", value: formatWhen(lecture.start, lecture.end, tz) },
            { label: "Length", value: formatDuration(recording.durationMins), mono: true },
            { label: "Module", value: module?.title || "–" },
            { label: "Instructor", value: lecture.instructor || batch.instructors.join(", ") || "–" },
          ]}
        />
      </Card>

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
    </StudentPage>
  );
}
