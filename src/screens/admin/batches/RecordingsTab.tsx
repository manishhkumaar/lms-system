import { useMemo, useState } from "react";
import { UploadRecordingDialog } from "@/components/UploadRecordingDialog";
import { useRun } from "@/components/useRun";
import { setRecordingPublished } from "@/data/actions";
import { useDb } from "@/data/store";
import { batchLectures, getLecture, getUser, isEnded, lectureLabel, recordingForLecture, seatsFilled } from "@/data/selectors";
import type { Batch, Recording } from "@/data/types";
import { Button, Card, DataTable, EmptyState, NameCell, StatusChip, Toggle, type Column } from "@/design-system";
import { formatDate, formatDuration, formatNumber, formatWhen, plural } from "@/lib/format";

export function RecordingsTab({ batch, now }: { batch: Batch; now: number }) {
  const db = useDb();
  const run = useRun();
  const [uploadId, setUploadId] = useState<string | null>(null);
  const filled = seatsFilled(db, batch.id);

  const recordings = useMemo(
    () =>
      db.recordings
        .filter((r) => r.batchId === batch.id)
        .sort((a, b) => (getLecture(db, b.lectureId)?.number || 0) - (getLecture(db, a.lectureId)?.number || 0)),
    [db, batch.id],
  );
  const awaiting = useMemo(
    () =>
      batchLectures(db, batch.id)
        .filter((l) => isEnded(l, now) && !recordingForLecture(db, l.id))
        .reverse(),
    [db, batch.id, now],
  );

  const columns: Column<Recording>[] = [
    {
      key: "lecture",
      label: "Lecture",
      render: (r) => {
        const l = getLecture(db, r.lectureId);
        return <NameCell name={r.title} sub={l ? `${lectureLabel(l)} · ${formatDate(l.start, l.timeZone)}` : undefined} />;
      },
    },
    { key: "duration", label: "Length", render: (r) => <span className="bl-mono nowrap">{formatDuration(r.durationMins)}</span> },
    {
      key: "uploaded",
      label: "Uploaded",
      render: (r) => (
        <span className="nowrap">
          {formatDate(r.uploadedAt)}
          <span className="bl-cell-sub">{getUser(db, r.uploadedBy)?.name ? `by ${getUser(db, r.uploadedBy)!.name}` : ""}</span>
        </span>
      ),
    },
    { key: "status", label: "Status", render: (r) => <StatusChip status={r.status === "ready" ? "recording-ready" : "recording-processing"} /> },
    {
      key: "published",
      label: "Students see it",
      render: (r) => (
        <Toggle
          label={r.published ? "Published" : "Hidden"}
          description={r.status !== "ready" ? "Available after processing" : undefined}
          checked={r.published}
          disabled={r.status !== "ready" || batch.lifecycle === "cancelled"}
          onChange={(on) =>
            void run(() => setRecordingPublished(r.id, on), on ? "Recording published" : "Recording hidden", on ? `${plural(filled, "student")} in ${batch.code} can watch it now.` : "Students in this batch no longer see it.")
          }
        />
      ),
    },
    { key: "views", label: "Views", numeric: true, render: (r) => formatNumber(r.views) },
  ];

  return (
    <div className="stack-3">
      {awaiting.length ? (
        <Card flush title="Awaiting upload" description={`${plural(awaiting.length, "finished lecture")} without a recording`}>
          <ul className="list">
            {awaiting.map((l) => (
              <li key={l.id}>
                <span className="acd-num">{l.number}</span>
                <div className="acd-grow">
                  <div className="list-title">{l.title}</div>
                  <div className="list-sub">{`Ended · ${formatWhen(l.start, l.end, l.timeZone)}`}</div>
                </div>
                <Button variant="secondary" className="acd-small-btn" icon="upload" onClick={() => setUploadId(l.id)}>
                  Upload recording
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <DataTable
        columns={columns}
        rows={recordings}
        footer={recordings.length ? <span>{`${plural(recordings.length, "recording")} · ${recordings.filter((r) => r.published).length} published`}</span> : undefined}
        empty={<EmptyState icon="video" title="No recordings yet" description="Recordings appear here after each lecture once Operations uploads them." />}
      />
      <UploadRecordingDialog open={!!uploadId} onClose={() => setUploadId(null)} lectureId={uploadId || undefined} />
    </div>
  );
}
