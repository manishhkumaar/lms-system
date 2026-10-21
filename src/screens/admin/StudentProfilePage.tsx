"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EnrolDialog, TransferDialog } from "@/components/EnrolDialog";
import { BatchChip } from "@/components/StatusChips";
import { errorMessage, useRun } from "@/components/useRun";
import { dropEnrolment, inviteStudent, updateStudent } from "@/data/actions";
import { useDb } from "@/data/store";
import { attendanceRecord, batchLectures, getBatch, getCourse, getLead, getUser, isEnded, isLive, lectureLabel, studentAttendance, studentEnrolments, studentProgress } from "@/data/selectors";
import type { Enrolment, ID, Lecture, Student } from "@/data/types";
import { Avatar, Banner, Button, Card, CopyField, DataTable, EmptyState, Icon, MetaList, NameCell, Progress, SegmentedControl, StatusChip, Tabs, TextField, useToast } from "@/design-system";
import { formatDate, formatINR, formatRange24, formatTime24, plural } from "@/lib/format";
import { tzLabel } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { EnrolmentStatusChip } from "./EnrolmentsPage";
import { ActivityTimeline } from "./leads/LeadPanel";
import { formatPhone, isValidEmail, isValidPhone } from "./leads/leadUtils";
import "./admissions.css";

type Tab = "overview" | "attendance" | "lead" | "details";

/** Student Profile: enrolments, verified attendance, lead history and contact details. */
export function StudentProfilePage() {
  const { studentId = "" } = useParams();
  const db = useDb();
  const user = useUser();
  const now = useNow(60000);
  const student = db.students.find((s) => s.id === studentId);
  const [tab, setTab] = useState<Tab>("overview");
  const [enrolling, setEnrolling] = useState(false);

  if (!student) {
    return (
      <AdminPage title="Student not found" breadcrumb={<Crumbs items={[{ label: "Students", to: "/admin/students" }, { label: "Not found" }]} />}>
        <div className="bl-card">
          <EmptyState
            icon="users"
            title="This student doesn't exist"
            description="The link may be old, or the record may have been removed."
            action={
              <Link to="/admin/students" className="bl-btn bl-btn-secondary" style={{ textDecoration: "none" }}>
                Go to Student Directory
              </Link>
            }
          />
        </div>
      </AdminPage>
    );
  }

  const lead = getLead(db, student.leadId);
  const enrolments = studentEnrolments(db, student.id);
  const tabs = [
    { value: "overview", label: "Overview", count: enrolments.length },
    { value: "attendance", label: "Attendance" },
    ...(lead ? [{ value: "lead", label: "Lead history" }] : []),
    { value: "details", label: "Details" },
  ];

  return (
    <AdminPage
      title={student.name}
      breadcrumb={<Crumbs items={[{ label: "Students", to: user.role === "admissions" ? "/admin/enrolments" : "/admin/students" }, { label: student.name }]} />}
      actions={
        <Button icon="graduation" onClick={() => setEnrolling(true)}>
          Enrol in batch
        </Button>
      }
    >
      <ProfileHeader student={student} />
      <Tabs items={tabs} value={tab} onChange={(v) => setTab(v as Tab)} />
      {tab === "overview" ? <Overview student={student} enrolments={enrolments} onEnrol={() => setEnrolling(true)} /> : null}
      {tab === "attendance" ? <AttendanceTab student={student} enrolments={enrolments} /> : null}
      {tab === "lead" && lead ? (
        <Card
          title="Lead history"
          description={`Came in through ${lead.source} on ${formatDate(lead.createdAt)}.`}
          actions={
            canAccess(user.role, "leads") ? (
              <Link to={`/admin/leads?lead=${lead.id}`} className="bl-btn bl-btn-secondary" style={{ textDecoration: "none" }}>
                Open lead
              </Link>
            ) : null
          }
        >
          <ActivityTimeline lead={lead} now={now} />
        </Card>
      ) : null}
      {tab === "details" ? <DetailsForm student={student} /> : null}
      <EnrolDialog open={enrolling} studentId={student.id} onClose={() => setEnrolling(false)} />
    </AdminPage>
  );
}

function ProfileHeader({ student }: { student: Student }) {
  const db = useDb();
  const run = useRun();
  // An activated account, or the open invitation (an "invited" user linked to this student).
  const account = getUser(db, student.userId) || db.users.find((u) => u.status === "invited" && u.studentId === student.id);
  const [link, setLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  useEffect(() => setLink(null), [student.id]);

  const invite = async () => {
    if (inviting) return;
    setInviting(true);
    const path = await run(() => inviteStudent(student.id), account ? "New invite link ready" : "Invite link ready", `Send ${student.name} the activation link so they can set a password.`);
    setInviting(false);
    if (path) setLink(window.location.origin + path);
  };

  return (
    <div className="bl-card bl-card-body">
      <div className="adm-profile">
        <Avatar name={student.name} size="lg" />
        <div className="adm-profile-main">
          <h2 className="t-h2">{student.name}</h2>
          <div className="adm-contact">
            <span>
              <Icon name="mail" />
              <a href={`mailto:${student.email}`}>{student.email}</a>
            </span>
            <span>
              <Icon name="phone" />
              <span className="bl-mono">{student.phone}</span>
            </span>
            {student.city ? (
              <span>
                <Icon name="home" />
                {student.city}
              </span>
            ) : null}
            <span>Student since {formatDate(student.createdAt)}</span>
          </div>
        </div>
        <div className="stack-1" style={{ alignItems: "flex-end" }}>
          {account?.status === "active" ? (
            <StatusChip status="account-active" tone="success">
              Account active
            </StatusChip>
          ) : account?.status === "invited" ? (
            <StatusChip status="invite-pending" tone="warning">
              Invite pending
            </StatusChip>
          ) : (
            <StatusChip status="no-account" tone="neutral">
              No account
            </StatusChip>
          )}
          {account?.status !== "active" ? (
            <Button variant="secondary" icon="mail" disabled={inviting} onClick={() => void invite()}>
              {account ? "Create new invite link" : "Create invite link"}
            </Button>
          ) : null}
        </div>
      </div>
      {link ? (
        <div className="stack-1" style={{ marginTop: "var(--space-2)" }}>
          <span className="bl-field-label">Activation link (send it to {student.name}; it works once)</span>
          <CopyField value={link} label="activation link" />
        </div>
      ) : null}
    </div>
  );
}

function Overview({ student, enrolments, onEnrol }: { student: Student; enrolments: Enrolment[]; onEnrol: () => void }) {
  const db = useDb();
  const now = useNow(60000);
  const run = useRun();
  const [transfer, setTransfer] = useState<Enrolment | null>(null);
  const [removing, setRemoving] = useState<Enrolment | null>(null);
  const removingBatch = getBatch(db, removing?.batchId);

  if (!enrolments.length) {
    return (
      <div className="bl-card">
        <EmptyState icon="layers" title="Not enrolled in any batch" description={`Enrol ${student.name} in a batch with seats left. They'll see its live classes and recordings once they sign in.`} action={<Button variant="secondary" icon="graduation" onClick={onEnrol}>Enrol in batch</Button>} />
      </div>
    );
  }

  return (
    <>
      <div className="grid-2">
        {enrolments.map((e) => {
          const b = getBatch(db, e.batchId);
          if (!b) return null;
          const course = getCourse(db, b.courseId);
          const att = studentAttendance(db, student.id, b.id, now);
          const progress = studentProgress(db, student.id, b.id);
          const active = e.status === "active";
          return (
            <Card
              key={e.id}
              title={
                <Link to={`/admin/batches/${b.id}`} style={{ color: "inherit" }}>
                  {b.name}
                </Link>
              }
              description={course?.title}
              actions={active ? <BatchChip batch={b} now={now} /> : <EnrolmentStatusChip status={e.status} />}
            >
              <div className="stack">
                <MetaList
                  items={[
                    { label: "Batch code", value: b.code, mono: true },
                    { label: "Enrolled on", value: formatDate(e.enrolledAt) },
                    { label: "Fee paid", value: course && e.feePaid < course.fee ? `${formatINR(e.feePaid)} of ${formatINR(course.fee)}` : formatINR(e.feePaid) },
                    { label: "Schedule", value: `${b.days.join(", ")} · ${b.slotStart}–${b.slotEnd} ${tzLabel(b.timeZone)}` },
                    {
                      label: "Verified attendance",
                      value: att.held ? `${att.present} of ${plural(att.held, "lecture")} · ${Math.round(att.pct)}%` : "No lectures held yet",
                    },
                    ...(e.status === "transferred" && e.transferredTo ? [{ label: "Moved to", value: getBatch(db, e.transferredTo)?.code || "—", mono: true }] : []),
                  ]}
                />
                <div className="stack-1">
                  <span className="caption">Progress: verified present for {progress}% of the batch's lectures</span>
                  <Progress value={progress} label="Progress" />
                </div>
              </div>
              {active ? (
                <div className="adm-enrol-foot">
                  <Button variant="secondary" icon="transfer" onClick={() => setTransfer(e)}>
                    Transfer student
                  </Button>
                  <Button variant="ghost" onClick={() => setRemoving(e)}>
                    Remove from batch
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
      {transfer ? <TransferDialog open enrolment={transfer} onClose={() => setTransfer(null)} /> : null}
      <ConfirmDialog
        open={!!removing}
        title="Remove from batch"
        description={removingBatch ? `Remove ${student.name} from ${removingBatch.name}? They lose access to its live classes and recordings. Attendance so far is kept.` : ""}
        confirmLabel="Remove from batch"
        cancelLabel="Keep in batch"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) void run(() => dropEnrolment(removing.id), `${student.name} removed from ${removingBatch?.code}`);
        }}
      />
    </>
  );
}

interface AttendanceRow {
  id: ID;
  lecture: Lecture;
}

/** Join clicks and verified attendance in separate columns: joined is not attended. */
function AttendanceTab({ student, enrolments }: { student: Student; enrolments: Enrolment[] }) {
  const db = useDb();
  const now = useNow(30000);
  const batchIds = useMemo(() => [...new Set(enrolments.map((e) => e.batchId))], [enrolments]);
  const [batchId, setBatchId] = useState<ID>(batchIds[0] || "");
  const batch = getBatch(db, batchId);

  const rows = useMemo<AttendanceRow[]>(
    () =>
      batch
        ? batchLectures(db, batch.id)
            .filter((l) => l.status !== "cancelled" && (isEnded(l, now) || isLive(l, now)))
            .reverse()
            .map((l) => ({ id: l.id, lecture: l }))
        : [],
    [db, batch, now],
  );

  if (!batchIds.length || !batch) {
    return (
      <div className="bl-card">
        <EmptyState icon="checklist" title="No attendance yet" description="Attendance appears once the student is enrolled and their batch holds lectures." />
      </div>
    );
  }

  const summary = studentAttendance(db, student.id, batch.id, now);

  return (
    <div className="stack">
      {batchIds.length > 1 ? (
        <SegmentedControl label="Batch" value={batchId} onChange={setBatchId} options={batchIds.map((id) => ({ value: id, label: getBatch(db, id)?.code || id }))} />
      ) : null}
      <Banner tone="info" title={summary.held ? `Verified attendance: ${summary.present} of ${plural(summary.held, "lecture")} · ${Math.round(summary.pct)}%` : "No lectures held yet"}>
        Only verified presence counts. A Join click shows as Joined until the meeting provider or Operations confirms it.
        {summary.unverified ? ` ${plural(summary.unverified, "lecture")} still to verify.` : ""}
      </Banner>
      <DataTable<AttendanceRow>
        rows={rows}
        empty={<EmptyState icon="calendar" title="No lectures held yet" description={`${batch.name} starts on ${formatDate(batch.startDate)}.`} />}
        footer={rows.length ? <span>{plural(rows.length, "lecture")} held</span> : undefined}
        columns={[
          { key: "lecture", label: "Lecture", render: (r) => <NameCell name={lectureLabel(r.lecture)} sub={r.lecture.title} /> },
          {
            key: "when",
            label: "Date and time",
            render: (r) => (
              <span className="bl-mono nowrap">
                {formatDate(r.lecture.start, r.lecture.timeZone)} · {formatRange24(r.lecture.start, r.lecture.end, r.lecture.timeZone)} {tzLabel(r.lecture.timeZone, new Date(r.lecture.start))}
              </span>
            ),
          },
          {
            key: "join",
            label: "Join click",
            render: (r) => {
              const a = attendanceRecord(db, r.lecture.id, student.id);
              return a?.joinedAt ? (
                <span className="row nowrap">
                  <StatusChip status="joined" />
                  <span className="bl-mono caption">{formatTime24(a.joinedAt, r.lecture.timeZone)}</span>
                </span>
              ) : (
                "—"
              );
            },
          },
          {
            key: "verified",
            label: "Verified attendance",
            render: (r) => {
              const a = attendanceRecord(db, r.lecture.id, student.id);
              if (isLive(r.lecture, now)) return <StatusChip status="live">Live now</StatusChip>;
              return <StatusChip status={a?.verification === "present" ? "present" : a?.verification === "absent" ? "absent" : "unverified"} />;
            },
          },
          {
            key: "by",
            label: "Verified by",
            render: (r) => {
              const by = attendanceRecord(db, r.lecture.id, student.id)?.verifiedBy;
              return by === "provider" ? "Meeting provider" : by === "operations" ? "Operations" : "—";
            },
          },
        ]}
      />
    </div>
  );
}

function DetailsForm({ student }: { student: Student }) {
  const toast = useToast();
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [phone, setPhone] = useState(student.phone);
  const [city, setCity] = useState(student.city || "");
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "phone" | "form", string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(student.name);
    setEmail(student.email);
    setPhone(student.phone);
    setCity(student.city || "");
    setErrors({});
  }, [student.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = name !== student.name || email !== student.email || phone !== student.phone || city !== (student.city || "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter the student's full name.";
    if (!isValidEmail(email)) next.email = "Enter an email address like name@example.in.";
    if (!isValidPhone(phone)) next.phone = "Enter a 10-digit mobile number.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const emailChanged = email.trim().toLowerCase() !== student.email.toLowerCase();
    setSaving(true);
    try {
      await updateStudent(student.id, { name: name.trim(), email: email.trim().toLowerCase(), phone: formatPhone(phone), city: city.trim() || undefined });
      toast({
        title: "Details saved",
        description: emailChanged && student.userId ? "Class reminders go to the new email. Their sign-in email doesn't change." : "Class reminders use the new details.",
        tone: "success",
      });
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Contact details" description="Used for class reminders and their sign-in.">
      <form className="stack" onSubmit={(e) => void save(e)} noValidate style={{ maxWidth: 640 }}>
        {errors.form ? <Banner tone="danger">{errors.form}</Banner> : null}
        <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <div className="bl-grid-2">
          <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <TextField label="Mobile number" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
        </div>
        <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <div className="row">
          <Button type="submit" disabled={!dirty || saving} title={dirty ? undefined : "No changes to save"}>
            Save changes
          </Button>
          {dirty ? (
            <Button
              variant="ghost"
              onClick={() => {
                setName(student.name);
                setEmail(student.email);
                setPhone(student.phone);
                setCity(student.city || "");
                setErrors({});
              }}
            >
              Discard changes
            </Button>
          ) : (
            <span className="caption">No changes to save</span>
          )}
        </div>
      </form>
    </Card>
  );
}
