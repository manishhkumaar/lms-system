import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@/lib/router";
import { PublishLinkDialog } from "@/components/PublishLinkDialog";
import { LectureChip } from "@/components/StatusChips";
import { UploadRecordingDialog } from "@/components/UploadRecordingDialog";
import { useRun } from "@/components/useRun";
import { setRecordingPublished } from "@/data/actions";
import { useDb } from "@/data/store";
import { batchLectures, getLecture, isEnded, lectureLabel, recordingForLecture, seatsFilled, verifiedAttendanceRate } from "@/data/selectors";
import type { Batch, Lecture, Recording } from "@/data/types";
import { Button, Card, EmptyState, Icon, StatCard, StatGrid, type IconName } from "@/design-system";
import { formatNumber, formatWhen, plural } from "@/lib/format";

const CAP = 5;

interface Item {
  key: string;
  icon: IconName;
  title: string;
  sub: string;
  action: ReactNode;
}

export function OverviewTab({ batch, now, onTab }: { batch: Batch; now: number; onTab: (tab: string) => void }) {
  const db = useDb();
  const run = useRun();
  const [publishId, setPublishId] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);

  const data = useMemo(() => {
    const lectures = batchLectures(db, batch.id);
    const planned = lectures.filter((l) => l.status !== "cancelled");
    const held = planned.filter((l) => isEnded(l, now));
    const recs = db.recordings.filter((r) => r.batchId === batch.id);
    const ready = recs.filter((r) => r.status === "ready");
    const linkMissing = planned.filter((l) => !l.linkPublished && new Date(l.end).getTime() > now);
    const noRecording = held.filter((l) => !recordingForLecture(db, l.id)).reverse();
    const unpublished = ready.filter((r) => !r.published);
    const next = planned.filter((l) => new Date(l.end).getTime() > now).slice(0, 5);
    return { planned, held, recs, ready, linkMissing, noRecording, unpublished, next, rate: verifiedAttendanceRate(db, now, { batchId: batch.id }) };
  }, [db, batch.id, now]);

  const filled = seatsFilled(db, batch.id);
  const closed = batch.lifecycle === "cancelled";

  const items: Item[] = [];
  const more: string[] = [];
  data.linkMissing.slice(0, CAP).forEach((l: Lecture) =>
    items.push({
      key: `link-${l.id}`,
      icon: "link",
      title: `${lectureLabel(l)} · ${l.title}: link not published`,
      sub: formatWhen(l.start, l.end, l.timeZone),
      action: (
        <Button variant="secondary" className="acd-small-btn" onClick={() => setPublishId(l.id)}>
          Publish link
        </Button>
      ),
    }),
  );
  if (data.linkMissing.length > CAP) more.push(`${data.linkMissing.length - CAP} more lectures without links`);
  data.noRecording.slice(0, CAP).forEach((l) =>
    items.push({
      key: `rec-${l.id}`,
      icon: "upload",
      title: `${lectureLabel(l)} · ${l.title}: recording to upload`,
      sub: `Ended ${formatWhen(l.start, l.end, l.timeZone)}`,
      action: (
        <Button variant="secondary" className="acd-small-btn" onClick={() => setUploadId(l.id)}>
          Upload recording
        </Button>
      ),
    }),
  );
  if (data.noRecording.length > CAP) more.push(`${data.noRecording.length - CAP} more lectures without recordings`);
  data.unpublished.forEach((r: Recording) => {
    const l = getLecture(db, r.lectureId);
    items.push({
      key: `pub-${r.id}`,
      icon: "video",
      title: `${l ? lectureLabel(l) + " · " : ""}${r.title}: recording ready, not published`,
      sub: "Students in this batch can't see it yet",
      action: (
        <Button variant="secondary" className="acd-small-btn" onClick={() => void run(() => setRecordingPublished(r.id, true), "Recording published", `${plural(filled, "student")} in ${batch.code} can watch it now.`)}>
          Publish to batch
        </Button>
      ),
    });
  });

  const publishLecture = publishId ? getLecture(db, publishId) : undefined;

  return (
    <div className="stack-3">
      <StatGrid>
        <StatCard title="Seats" value={`${formatNumber(filled)}`} delta={`of ${formatNumber(batch.capacity)} seats filled`} />
        <StatCard title="Lectures held" value={`${data.held.length} of ${data.planned.length}`} delta={data.next[0] ? `Next: ${lectureLabel(data.next[0])}` : "No upcoming lectures"} />
        <StatCard title="Verified attendance" value={data.rate.expected ? `${Math.round(data.rate.pct)}%` : "—"} delta={data.rate.expected ? `${formatNumber(data.rate.present)} of ${formatNumber(data.rate.expected)} seats across held lectures` : "After the first lecture"} />
        <StatCard title="Recordings" value={formatNumber(data.ready.length)} delta={data.unpublished.length ? `${data.unpublished.length} not published` : data.ready.length ? "All published" : "None yet"} />
      </StatGrid>

      <div className="split">
        <Card flush title="Needs attention" description={items.length ? plural(items.length + more.length, "item") : undefined}>
          {items.length ? (
            <ul className="list">
              {items.map((it) => (
                <li key={it.key}>
                  <span className="subtle">
                    <Icon name={it.icon} />
                  </span>
                  <div className="acd-grow">
                    <div className="list-title">{it.title}</div>
                    <div className="list-sub">{it.sub}</div>
                  </div>
                  {closed ? null : it.action}
                </li>
              ))}
              {more.map((m) => (
                <li key={m}>
                  <span className="caption">{m}.</span>
                  <Button variant="ghost" className="acd-small-btn" onClick={() => onTab("lectures")}>
                    View lectures
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="check" title="Nothing needs attention" description="Links are published, recordings are uploaded and visible to the batch." />
          )}
        </Card>

        <Card flush title="Next lectures" actions={<Button variant="ghost" className="acd-small-btn" onClick={() => onTab("lectures")}>All lectures</Button>}>
          {data.next.length ? (
            <ul className="list">
              {data.next.map((l) => (
                <li key={l.id}>
                  <Link to={`/admin/lectures/${l.id}`} className="list-link">
                    <span className="acd-num">{l.number}</span>
                    <span className="acd-grow">
                      <span className="list-title" style={{ display: "block" }}>
                        {l.title}
                      </span>
                      <span className="list-sub">{formatWhen(l.start, l.end, l.timeZone)}</span>
                    </span>
                  </Link>
                  <LectureChip lecture={l} now={now} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="calendar" title="No upcoming lectures" description={closed ? "This batch was cancelled." : "Schedule a lecture to see it here."} />
          )}
        </Card>
      </div>

      {publishLecture ? <PublishLinkDialog open onClose={() => setPublishId(null)} lecture={publishLecture} /> : null}
      <UploadRecordingDialog open={!!uploadId} onClose={() => setUploadId(null)} lectureId={uploadId || undefined} />
    </div>
  );
}
