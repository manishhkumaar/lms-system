import { Link } from "@/lib/router";
import { getBatch } from "@/data/selectors";
import { studentLectureState, visibleRecording } from "@/data/studentSelectors";
import type { Batch, DB, Lecture, Material, Recording } from "@/data/types";
import { Icon, StatusChip } from "@/design-system";
import { formatDate, formatDuration, formatWhen } from "@/lib/format";
import { KIND_ICON, KIND_LABEL } from "./util";

/** What a student can do with a lecture right now, as a link or a reason. */
export function LectureAction({ db, lecture, now }: { db: DB; lecture: Lecture; now: number }) {
  const st = studentLectureState(db, lecture, now);
  const rec = visibleRecording(db, lecture.id);
  if (st === "live")
    return (
      <Link to={`/learn/live/${lecture.id}`} className="bl-btn bl-btn-primary stu-action">
        <Icon name="video" />
        Join class
      </Link>
    );
  if (st === "recording-ready" && rec)
    return (
      <Link to={`/learn/recordings/${rec.id}`} className="bl-btn bl-btn-secondary stu-action">
        <Icon name="play" />
        Watch recording
      </Link>
    );
  if (st === "link-missing") return <span className="caption">Join appears here once your coordinator publishes the link</span>;
  if (st === "ended" || st === "recording-processing") return <span className="caption">Recording will appear here once it's uploaded</span>;
  return null;
}

/** One lecture in a list: number, title, batch, time with zone, status and the next step. */
export function LectureRow({ db, lecture, now, tz, showBatch = true }: { db: DB; lecture: Lecture; now: number; tz: string; showBatch?: boolean }) {
  const batch = getBatch(db, lecture.batchId);
  return (
    <div className="stu-lecture">
      <div className="stu-lecture-main">
        <Link to={`/learn/live/${lecture.id}`} className="stu-lecture-title">
          <span className="bl-mono stu-lecture-num">{lecture.number}</span>
          {lecture.title}
        </Link>
        <div className="stu-lecture-meta">
          <span className="bl-mono">{formatWhen(lecture.start, lecture.end, tz)}</span>
          {showBatch && batch ? <span> · {batch.code}</span> : null}
        </div>
      </div>
      <div className="stu-lecture-side">
        <StatusChip status={studentLectureState(db, lecture, now)} />
        <LectureAction db={db} lecture={lecture} now={now} />
      </div>
    </div>
  );
}

/** A recording tile: thumbnail block, title, lecture number and date, duration. */
export function RecordingItem({ recording, lecture, batch, tz, showBatch }: { recording: Recording; lecture: Lecture; batch: Batch; tz: string; showBatch?: boolean }) {
  return (
    <Link to={`/learn/recordings/${recording.id}`} className="list-link stu-rec">
      <span className="bl-live-thumb" aria-hidden="true">
        <Icon name="play" size="lg" />
      </span>
      <span className="stu-rec-text">
        <span className="list-title">{recording.title}</span>
        <span className="list-sub">
          Lecture {lecture.number} · {formatDate(lecture.start, tz)}
          {showBatch ? ` · ${batch.code}` : ""}
        </span>
      </span>
      <span className="bl-mono caption nowrap">{formatDuration(recording.durationMins)}</span>
    </Link>
  );
}

/** A material in a list: kind icon, title, module, updated date. */
export function MaterialItem({ material, moduleTitle, tz }: { material: Material; moduleTitle?: string; tz: string }) {
  return (
    <Link to={`/learn/materials/${material.id}`} className="list-link">
      <span className="stu-kind" aria-hidden="true">
        <Icon name={KIND_ICON[material.kind]} />
      </span>
      <span className="stu-rec-text">
        <span className="list-title">{material.title}</span>
        <span className="list-sub">
          {KIND_LABEL[material.kind]}
          {moduleTitle ? ` · ${moduleTitle}` : ""} · Updated {formatDate(material.updatedAt, tz)}
        </span>
      </span>
      <Icon name="chevronRight" className="subtle" />
    </Link>
  );
}
