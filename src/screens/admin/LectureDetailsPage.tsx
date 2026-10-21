"use client";
import "./delivery.css";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PublishLinkDialog } from "@/components/PublishLinkDialog";
import { ScheduleLectureDialog } from "@/components/ScheduleLectureDialog";
import { LectureChip } from "@/components/StatusChips";
import { UploadRecordingDialog } from "@/components/UploadRecordingDialog";
import { useRun } from "@/components/useRun";
import { cancelLecture, deleteRecording, importProviderAttendance, setRecordingPublished, verifyAttendance } from "@/data/actions";
import { useDb } from "@/data/store";
import { attendanceRecord, batchStudents, getBatch, getCourse, getLecture, getUser, isEnded, lectureAttendance, lectureLabel, lectureState, recordingForLecture } from "@/data/selectors";
import type { Attendance, Student } from "@/data/types";
import { Banner, Button, Card, CopyField, DataTable, EmptyState, FilterBar, Icon, MetaList, NameCell, SectionHeader, StatusChip, Toggle, useToast, type Column } from "@/design-system";
import { formatDateTime, formatDuration, formatNumber, formatTime, formatTime24, formatWhen, plural } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { batchShortName, useViewerZone } from "./delivery/shared";

type DialogKind = "link" | "upload" | "reschedule" | "cancel" | "delete-rec";

interface Row {
  id: string;
  student: Student;
  rec: Attendance | undefined;
}

const VERIFIED_OPTIONS = [
  { value: "present", label: "Present · verified" },
  { value: "absent", label: "Absent" },
  { value: "unverified", label: "Unverified" },
];
const JOIN_OPTIONS = [
  { value: "joined", label: "Joined" },
  { value: "not-joined", label: "Didn't join" },
];

/** Lecture Details: link, recording and verified attendance for one live session. */
export function LectureDetailsPage() {
  const { lectureId } = useParams();
  const db = useDb();
  const user = useUser();
  const now = useNow(5000);
  const nav = useNavigate();
  const run = useRun();
  const toast = useToast();
  const { tz, label } = useViewerZone();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState<string | undefined>();
  const [joined, setJoined] = useState<string | undefined>();

  const lecture = getLecture(db, lectureId);

  const rows = useMemo<Row[]>(() => {
    if (!lecture) return [];
    return batchStudents(db, lecture.batchId)
      .map((s) => ({ id: s.id, student: s, rec: attendanceRecord(db, lecture.id, s.id) }))
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [db, lecture]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (s && !r.student.name.toLowerCase().includes(s) && !r.student.email.toLowerCase().includes(s)) return false;
      if (verified && (r.rec?.verification ?? "unverified") !== verified) return false;
      if (joined === "joined" && !r.rec?.joinedAt) return false;
      if (joined === "not-joined" && r.rec?.joinedAt) return false;
      return true;
    });
  }, [rows, q, verified, joined]);

  if (!lecture) {
    return (
      <AdminPage title="Lecture not found" breadcrumb={<Crumbs items={[{ label: "Schedule", to: "/admin/schedule" }, { label: "Lecture" }]} />}>
        <div className="bl-card">
          <EmptyState
            icon="calendar"
            title="This lecture doesn't exist"
            description="It may have been removed, or the link you followed is wrong."
            action={
              <Button variant="secondary" icon="calendar" onClick={() => nav("/admin/schedule")}>
                View schedule
              </Button>
            }
          />
        </div>
      </AdminPage>
    );
  }

  const batch = getBatch(db, lecture.batchId);
  const course = getCourse(db, batch?.courseId);
  const rec = recordingForLecture(db, lecture.id);
  const state = lectureState(lecture, rec, now);
  const att = lectureAttendance(db, lecture);
  const startMs = new Date(lecture.start).getTime();
  const started = now >= startMs;
  const ended = isEnded(lecture, now);
  const cancelled = lecture.status === "cancelled";
  const batchLink = batch && canAccess(user.role, "batches") ? <Link to={`/admin/batches/${batch.id}`}>{batch.name}</Link> : batch?.name;
  const durationMs = new Date(lecture.end).getTime() - startMs;

  const importAttendance = async () => {
    const res = await run(() => importProviderAttendance(lecture.id));
    if (res) toast({ title: "Provider attendance imported", description: `${res.present} present · ${res.absent} absent. Corrections made by Operations were kept.`, tone: "success" });
  };

  /* ---------- Topbar actions: one primary, at most one secondary ---------- */
  let primary: ReactNode = null;
  let secondary: ReactNode = null;
  if (!cancelled) {
    if (!started) {
      if (!lecture.linkPublished) {
        primary = (
          <Button icon="link" onClick={() => setDialog("link")}>
            Publish link
          </Button>
        );
        secondary = (
          <Button variant="secondary" icon="calendar" onClick={() => setDialog("reschedule")}>
            Reschedule lecture
          </Button>
        );
      } else {
        primary = (
          <Button icon="calendar" onClick={() => setDialog("reschedule")}>
            Reschedule lecture
          </Button>
        );
      }
    } else if (state === "live") {
      primary =
        lecture.linkPublished && lecture.meetingUrl ? (
          <a className="bl-btn bl-btn-primary" href={lecture.meetingUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <Icon name="external" />
            Open meeting
          </a>
        ) : (
          <Button icon="link" onClick={() => setDialog("link")}>
            Publish link
          </Button>
        );
    } else if (!rec) {
      primary = (
        <Button icon="upload" onClick={() => setDialog("upload")}>
          Upload recording
        </Button>
      );
    } else if (att.unverified > 0) {
      primary = (
        <Button icon="checklist" onClick={() => void importAttendance()}>
          Import from meeting provider
        </Button>
      );
    }
  }

  /* ---------- Attendance table ---------- */
  const columns: Column<Row>[] = [
    { key: "student", label: "Student", render: (r) => <NameCell name={r.student.name} sub={r.student.email} /> },
    {
      key: "join",
      label: "Join click",
      render: (r) =>
        r.rec?.joinedAt ? (
          <span className="dlv-join">
            <StatusChip status="joined" />
            <span className="bl-mono caption">
              {formatTime24(r.rec.joinedAt, tz)} {label}
            </span>
          </span>
        ) : (
          <span className="subtle">—</span>
        ),
    },
    { key: "verified", label: "Verified attendance", render: (r) => <StatusChip status={r.rec?.verification ?? "unverified"} /> },
    { key: "by", label: "Verified by", render: (r) => (r.rec?.verifiedBy === "provider" ? "Provider" : r.rec?.verifiedBy === "operations" ? "Operations" : "—") },
  ];
  if (ended) {
    columns.push({
      key: "actions",
      label: <span className="visually-hidden">Actions</span>,
      render: (r) => (
        <div className="dlv-row-actions">
          {r.rec?.verification !== "present" ? (
            <Button variant="ghost" icon="check" onClick={() => run(() => verifyAttendance(lecture.id, r.student.id, "present"))}>
              Mark present
            </Button>
          ) : null}
          {r.rec?.verification !== "absent" ? (
            <Button variant="ghost" icon="x" onClick={() => run(() => verifyAttendance(lecture.id, r.student.id, "absent"))}>
              Mark absent
            </Button>
          ) : null}
        </div>
      ),
    });
  }

  const providerButton = cancelled ? null : (
    <Button variant="secondary" icon="checklist" disabled={!ended} onClick={() => void importAttendance()}>
      {ended ? "Import from meeting provider" : "Provider report available after the lecture ends"}
    </Button>
  );

  /* ---------- Side cards ---------- */
  const linkCard = (
    <Card
      title="Meeting link"
      actions={lecture.linkPublished ? <StatusChip status="published" tone="success">Published</StatusChip> : <StatusChip status="link-missing" />}
    >
      <div className="dlv-card-stack">
        {lecture.meetingUrl ? <CopyField value={lecture.meetingUrl} label="meeting link" /> : <p className="muted">No link added yet.</p>}
        <p className="caption">
          Students see Join only while the lecture is on, and only if they're enrolled in {batch?.code ?? "this batch"}.
        </p>
        {cancelled ? null : ended ? (
          <p className="caption">This lecture has ended, so the link no longer matters to students.</p>
        ) : (
          <div>
            <Button variant="secondary" icon="link" onClick={() => setDialog("link")}>
              {lecture.linkPublished ? "Update link" : "Publish link"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );

  let recordingBody: ReactNode;
  if (cancelled) {
    recordingBody = <p className="muted">No recording: this lecture was cancelled.</p>;
  } else if (!ended) {
    recordingBody = (
      <div className="dlv-card-stack">
        <p className="muted">
          Upload the recording after the lecture ends at {formatTime(lecture.end, tz)} {label}.
        </p>
        <div>
          <Button variant="secondary" icon="upload" disabled>
            Upload opens after the lecture ends
          </Button>
        </div>
      </div>
    );
  } else if (!rec) {
    recordingBody = (
      <div className="dlv-card-stack">
        <p className="muted">No recording yet. Students see "Recording will appear here once it's uploaded".</p>
        <div>
          <Button variant="secondary" icon="upload" onClick={() => setDialog("upload")}>
            Upload recording
          </Button>
        </div>
      </div>
    );
  } else {
    recordingBody = (
      <div className="dlv-card-stack">
        {rec.status === "ready" ? (
          <Toggle
            label="Visible to students"
            description={rec.published ? `Everyone in ${batch?.code} can watch it.` : "Hidden from students until you turn this on."}
            checked={rec.published}
            onChange={(on) => run(() => setRecordingPublished(rec.id, on), on ? "Recording published" : "Recording hidden", on ? `Students in ${batch?.code} can watch it now.` : `Students in ${batch?.code} no longer see it.`)}
          />
        ) : (
          <p className="muted">Processing. You can publish it to the batch once it's ready.</p>
        )}
        <MetaList
          items={[
            { label: "Length", value: formatDuration(rec.durationMins) },
            { label: "Views", value: formatNumber(rec.views), mono: true },
            { label: "File", value: rec.fileName, mono: true },
            { label: "Size", value: `${formatNumber(rec.sizeMb)} MB`, mono: true },
            { label: "Uploaded", value: `${formatDateTime(rec.uploadedAt, tz)}${getUser(db, rec.uploadedBy) ? ` by ${getUser(db, rec.uploadedBy)!.name}` : ""}` },
          ]}
        />
        <div>
          <Button variant="ghost" icon="trash" onClick={() => setDialog("delete-rec")}>
            Delete recording
          </Button>
        </div>
      </div>
    );
  }

  const recordingCard = (
    <Card title="Recording" actions={rec ? <StatusChip status={rec.status === "ready" ? "recording-ready" : "recording-processing"} /> : ended && !cancelled ? <StatusChip status="ended" /> : null}>
      {recordingBody}
    </Card>
  );

  const changeCard = (
    <Card title="Change or cancel">
      {cancelled ? (
        <p className="muted">This lecture was cancelled. Students in {batch?.code} were notified.</p>
      ) : started ? (
        <p className="muted">This lecture has {ended ? "ended" : "started"}, so it can't be rescheduled or cancelled.</p>
      ) : (
        <div className="dlv-card-stack">
          <p className="caption">Rescheduling or cancelling notifies {plural(att.expected, "student")} in {batch?.code}. The meeting link moves with the lecture.</p>
          <div className="row">
            <Button variant="secondary" icon="calendar" onClick={() => setDialog("reschedule")}>
              Reschedule lecture
            </Button>
            <Button variant="danger" onClick={() => setDialog("cancel")}>
              Cancel lecture
            </Button>
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <AdminPage
      title={lecture.title}
      breadcrumb={
        <Crumbs
          items={[
            { label: "Schedule", to: "/admin/schedule" },
            { label: batch?.code ?? "Batch", to: batch && canAccess(user.role, "batches") ? `/admin/batches/${batch.id}` : undefined },
            { label: lectureLabel(lecture) },
          ]}
        />
      }
      actions={
        primary || secondary ? (
          <>
            {secondary}
            {primary}
          </>
        ) : undefined
      }
    >
      {state === "live" ? (
        <Banner tone="danger" title="Live now">
          Ends at {formatTime(lecture.end, tz)} {label}. {att.joined} of {plural(att.expected, "student")} have clicked Join so far.
          {!lecture.linkPublished ? " The link isn't published, so students can't join." : ""}
        </Banner>
      ) : null}
      {cancelled ? <Banner tone="danger" title="Cancelled">This lecture was cancelled and students were notified.</Banner> : null}
      {!started && !cancelled && !lecture.linkPublished ? (
        <Banner tone="warning" title="Link not published">
          Students can't join until you publish the meeting link.
        </Banner>
      ) : null}

      <Card title={`${lectureLabel(lecture)} · ${batch?.name ?? ""}`} actions={<LectureChip lecture={lecture} now={now} />}>
        <MetaList
          columns={3}
          items={[
            { label: "Batch", value: batchLink ?? "—" },
            { label: "Course", value: course?.title ?? "—" },
            { label: "When", value: formatWhen(lecture.start, lecture.end, tz) },
            { label: "Instructor", value: lecture.instructor || "Not assigned" },
            { label: "Students", value: plural(att.expected, "student") },
            ...(lecture.previousStart
              ? [{ label: "Moved from", value: formatWhen(lecture.previousStart, new Date(new Date(lecture.previousStart).getTime() + durationMs), tz) }]
              : []),
          ]}
        />
        {lecture.agenda ? <p className="dlv-agenda-text">{lecture.agenda}</p> : null}
      </Card>

      <div className="dlv-split">
        <div className="dlv-side">
          {linkCard}
          {recordingCard}
          {changeCard}
        </div>
        <div className="dlv-main">
          <SectionHeader
            title="Attendance for this lecture"
            description={
              <span className="dlv-attn-summary">
                <span>
                  Joined <strong>{att.joined}</strong>
                </span>
                <span>
                  Verified present <strong>{att.present}</strong>
                </span>
                <span>
                  Absent <strong>{att.absent}</strong>
                </span>
                <span>
                  Unverified <strong>{att.unverified}</strong> of <strong>{att.expected}</strong>
                </span>
              </span>
            }
            actions={providerButton}
          />
          <Banner tone="info">Joined is a Join click, not attendance. Only verified presence counts in reports.</Banner>
          <DataTable
              columns={columns}
              rows={shown}
              toolbar={
                <FilterBar
                  searchPlaceholder="Search students"
                  searchValue={q}
                  onSearch={setQ}
                  filters={[
                    { label: "Verified attendance", value: VERIFIED_OPTIONS.find((o) => o.value === verified)?.label, options: VERIFIED_OPTIONS, onSelect: setVerified },
                    { label: "Join click", value: JOIN_OPTIONS.find((o) => o.value === joined)?.label, options: JOIN_OPTIONS, onSelect: setJoined },
                  ]}
                />
              }
              empty={
                rows.length ? (
                  <EmptyState icon="filter" title="No students match these filters" action={<Button variant="secondary" onClick={() => { setQ(""); setVerified(undefined); setJoined(undefined); }}>Clear filters</Button>} />
                ) : (
                  <EmptyState icon="users" title="No students in this batch yet" description="Students appear here once they're enrolled in the batch." />
                )
              }
              footer={<span>{plural(shown.length, "student")}{ended ? "" : ". Verification opens after the lecture ends."}</span>}
            />
        </div>
      </div>

      <PublishLinkDialog open={dialog === "link"} onClose={() => setDialog(null)} lecture={lecture} />
      <UploadRecordingDialog open={dialog === "upload"} onClose={() => setDialog(null)} lectureId={lecture.id} />
      <ScheduleLectureDialog open={dialog === "reschedule"} onClose={() => setDialog(null)} lecture={lecture} />
      <ConfirmDialog
        open={dialog === "cancel"}
        title="Cancel lecture"
        description={`Cancel ${lectureLabel(lecture).toLowerCase()} for ${batchShortName(batch?.name)}? ${plural(att.expected, "student")} will be notified.`}
        cancelLabel="Keep lecture"
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => cancelLecture(lecture.id), "Lecture cancelled", `${plural(att.expected, "student")} in ${batch?.code} will be notified.`)}
      />
      {rec ? (
        <ConfirmDialog
          open={dialog === "delete-rec"}
          title="Delete recording"
          description={`Delete the recording of ${lectureLabel(lecture).toLowerCase()} for ${batch?.code}? Students lose access straight away. You can upload it again.`}
          cancelLabel="Keep recording"
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => deleteRecording(rec.id), "Recording deleted")}
        />
      ) : null}
    </AdminPage>
  );
}
