import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PublishLinkDialog } from "@/components/PublishLinkDialog";
import { ScheduleLectureDialog } from "@/components/ScheduleLectureDialog";
import { LectureChip } from "@/components/StatusChips";
import { UploadRecordingDialog } from "@/components/UploadRecordingDialog";
import { useRun } from "@/components/useRun";
import { cancelLecture } from "@/data/actions";
import { useDb } from "@/data/store";
import { batchLectures, getLecture, isEnded, recordingForLecture, seatsFilled } from "@/data/selectors";
import type { Batch, Lecture } from "@/data/types";
import { Button, DataTable, EmptyState, FilterBar, Icon, Menu, NameCell, SegmentedControl, type Column, type MenuItem } from "@/design-system";
import { formatDayMonth, formatRange24, formatWeekdayDate, plural } from "@/lib/format";
import { tzLabel } from "@/lib/time";
import { batchShort } from "./batchFormat";

type View = "all" | "upcoming" | "past";

export function LecturesTab({ batch, now, onSchedule }: { batch: Batch; now: number; onSchedule: () => void }) {
  const db = useDb();
  const nav = useNavigate();
  const run = useRun();
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");
  const [publishId, setPublishId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const filled = seatsFilled(db, batch.id);
  const closed = batch.lifecycle === "cancelled";

  const all = useMemo(() => batchLectures(db, batch.id), [db, batch.id]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((l) => {
      const ended = new Date(l.end).getTime() <= now;
      if (view === "upcoming" && (ended || l.status === "cancelled")) return false;
      if (view === "past" && !ended) return false;
      return !s || l.title.toLowerCase().includes(s) || String(l.number) === s;
    });
  }, [all, q, view, now]);

  const menuFor = (l: Lecture): MenuItem[] => {
    const ended = isEnded(l, now);
    const cancelled = l.status === "cancelled";
    const started = new Date(l.start).getTime() <= now;
    const hasRec = !!recordingForLecture(db, l.id);
    return [
      { label: "Open lecture details", icon: "external", onClick: () => nav(`/admin/lectures/${l.id}`) },
      { label: l.linkPublished ? "Update link" : "Publish link", icon: "link", disabled: cancelled || ended, hint: ended ? "Ended" : cancelled ? "Cancelled" : undefined, onClick: () => setPublishId(l.id) },
      { label: "Reschedule", icon: "calendar", disabled: cancelled || started, hint: started && !cancelled ? (ended ? "Ended" : "In progress") : cancelled ? "Cancelled" : undefined, onClick: () => setRescheduleId(l.id) },
      { label: "Upload recording", icon: "upload", disabled: !ended || hasRec, hint: hasRec ? "Uploaded" : !ended ? "After it ends" : undefined, onClick: () => setUploadId(l.id) },
      "separator",
      { label: "Cancel lecture", icon: "x", danger: true, disabled: cancelled || started, hint: cancelled ? "Cancelled" : started ? "Already started" : undefined, onClick: () => setCancelId(l.id) },
    ];
  };

  const columns: Column<Lecture>[] = [
    { key: "number", label: "No.", width: 56, render: (l) => <span className="bl-mono">{l.number}</span> },
    { key: "title", label: "Lecture", render: (l) => <NameCell name={l.title} sub={l.instructor} /> },
    {
      key: "when",
      label: "When",
      render: (l) => (
        <span className="nowrap">
          {formatWeekdayDate(l.start, l.timeZone)}
          <span className="bl-cell-sub bl-mono">
            {formatRange24(l.start, l.end, l.timeZone)} {tzLabel(l.timeZone, new Date(l.start))}
          </span>
          {l.status === "rescheduled" && l.previousStart ? <span className="bl-cell-sub">{`Moved from ${formatDayMonth(l.previousStart, l.timeZone)}`}</span> : null}
        </span>
      ),
    },
    { key: "status", label: "Status", render: (l) => <LectureChip lecture={l} now={now} /> },
    {
      key: "link",
      label: "Meeting link",
      render: (l) => {
        if (l.status === "cancelled") return <span className="subtle">—</span>;
        if (l.linkPublished)
          return (
            <span className="acd-ok">
              <Icon name="check" />
              Published
            </span>
          );
        if (isEnded(l, now)) return <span className="subtle">Not published</span>;
        return (
          <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Button variant="secondary" className="acd-small-btn" icon="link" disabled={closed} onClick={() => setPublishId(l.id)}>
              Publish link
            </Button>
          </span>
        );
      },
    },
    {
      key: "actions",
      label: <span className="visually-hidden">Actions</span>,
      width: 56,
      render: (l) => (
        <span className="acd-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Menu align="end" items={menuFor(l)} trigger={(p) => <Button variant="ghost" icon="more" className="acd-icon-btn" aria-label={`Actions for lecture ${l.number}`} {...p} />} />
        </span>
      ),
    },
  ];

  const publishLecture = publishId ? getLecture(db, publishId) : undefined;
  const rescheduleLecture = rescheduleId ? getLecture(db, rescheduleId) : undefined;
  const cancelling = cancelId ? getLecture(db, cancelId) : undefined;
  const upcoming = all.filter((l) => l.status !== "cancelled" && new Date(l.end).getTime() > now).length;
  const missing = all.filter((l) => l.status !== "cancelled" && !l.linkPublished && new Date(l.end).getTime() > now).length;

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(l) => nav(`/admin/lectures/${l.id}`)}
        toolbar={
          <FilterBar
            searchPlaceholder="Search lectures"
            searchValue={q}
            onSearch={setQ}
            end={
              <SegmentedControl
                label="Show lectures"
                value={view}
                onChange={setView}
                options={[
                  { value: "all", label: "All" },
                  { value: "upcoming", label: "Upcoming" },
                  { value: "past", label: "Past" },
                ]}
              />
            }
          />
        }
        footer={
          <span>{`${plural(all.length, "lecture")} · ${upcoming} upcoming${missing ? ` · ${plural(missing, "link")} not published` : ""}`}</span>
        }
        empty={
          all.length ? (
            <EmptyState icon="search" title="No lectures match" description="Try another search or show all lectures." />
          ) : (
            <EmptyState
              icon="calendar"
              title="No lectures scheduled"
              description="Schedule each live session with its date, time, zone and meeting link."
              action={
                closed ? undefined : (
                  <Button variant="secondary" icon="plus" onClick={onSchedule}>
                    Schedule lecture
                  </Button>
                )
              }
            />
          )
        }
      />
      {publishLecture ? <PublishLinkDialog open onClose={() => setPublishId(null)} lecture={publishLecture} /> : null}
      {rescheduleLecture ? <ScheduleLectureDialog open onClose={() => setRescheduleId(null)} lecture={rescheduleLecture} /> : null}
      <UploadRecordingDialog open={!!uploadId} onClose={() => setUploadId(null)} lectureId={uploadId || undefined} />
      <ConfirmDialog
        open={!!cancelling}
        title="Cancel lecture"
        description={cancelling ? `Cancel lecture ${cancelling.number} for ${batchShort(batch)}? ${plural(filled, "student")} will be notified.` : ""}
        confirmLabel="Cancel lecture"
        cancelLabel="Keep lecture"
        onConfirm={() => {
          if (cancelling) void run(() => cancelLecture(cancelling.id), `Lecture ${cancelling.number} cancelled`, `${plural(filled, "student")} in ${batch.code} will be notified.`);
        }}
        onClose={() => setCancelId(null)}
      />
    </>
  );
}
