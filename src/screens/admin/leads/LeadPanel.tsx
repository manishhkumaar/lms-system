import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { staffOptions } from "@/components/options";
import { useRun } from "@/components/useRun";
import { addLeadNote, assignLead, setFollowUp } from "@/data/actions";
import { useDb } from "@/data/store";
import { followUpDue, followUpOverdue, getBatch, getCourse, getLead, isLeadOpen } from "@/data/selectors";
import type { ID, Lead, LeadActivity } from "@/data/types";
import { Banner, Button, Menu, MetaList, SegmentedControl, SelectField, SidePanel, StatusChip, TextAreaField, TextField } from "@/design-system";
import { formatDate, formatDayMonth, formatRelative, formatTimeRange, formatWeekdayDate } from "@/lib/format";
import { tzLabel } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { INTERVIEW_MINS, NEXT_STAGE, STAGE_LABEL } from "./leadUtils";
import type { LeadStageMover } from "./StageDialogs";
import "../admissions.css";

const KIND_LABEL: Record<LeadActivity["kind"], string> = {
  note: "Note",
  call: "Call",
  stage: "Stage",
  "follow-up": "Follow-up",
  interview: "Interview",
  enrolment: "Enrolment",
};

/** "Thu, 23 Oct · 11:00–11:30 AM IST" */
export function interviewWhen(iso: string, tz = "Asia/Kolkata") {
  const end = new Date(new Date(iso).getTime() + INTERVIEW_MINS * 60000);
  return `${formatWeekdayDate(iso, tz)} · ${formatTimeRange(iso, end, tz)} ${tzLabel(tz, new Date(iso))}`;
}

/** Newest-first activity: notes, calls, stage changes and follow-ups. */
export function ActivityTimeline({ lead, now }: { lead: Lead; now: number }) {
  return (
    <ol className="timeline">
      {lead.activity.map((a) => (
        <li key={a.id} className={a.kind === "enrolment" ? "done" : undefined}>
          <div className="adm-activity-head">
            <span className="adm-activity-kind">{KIND_LABEL[a.kind]}</span>
            <span className="adm-activity-meta" title={formatDate(a.at)}>
              {a.by} · {formatRelative(a.at, now)}
            </span>
          </div>
          <div className="adm-activity-text">{a.text}</div>
        </li>
      ))}
    </ol>
  );
}

/** Lead details, follow-ups and history in a side panel. */
export function LeadPanel({ leadId, onClose, mover }: { leadId: ID | null; onClose: () => void; mover: LeadStageMover }) {
  const db = useDb();
  const user = useUser();
  const now = useNow(30000);
  const run = useRun();
  const lead = getLead(db, leadId || undefined);
  const [kind, setKind] = useState<"note" | "call">("note");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | undefined>();
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNote("");
    setNoteError(undefined);
    setKind("note");
  }, [leadId]);

  if (!lead) return null;

  const course = getCourse(db, lead.courseId);
  const batch = getBatch(db, lead.batchId);
  const due = followUpDue(lead, now);
  const overdue = followUpOverdue(lead, now);
  const open = isLeadOpen(lead);
  const next = NEXT_STAGE[lead.stage];
  const canSeeStudent = canAccess(user.role, "students");

  const saveNote = async () => {
    if (savingNote) return;
    if (!note.trim()) {
      setNoteError(kind === "call" ? "Write what was discussed on the call." : "Write the note first.");
      return;
    }
    setSavingNote(true);
    const saved = await run(() => addLeadNote(lead.id, note.trim(), kind), kind === "call" ? "Call logged" : "Note added");
    setSavingNote(false);
    if (saved) {
      setNote("");
      setNoteError(undefined);
    }
  };

  const stageMenu = (
    <Menu
      items={(["new", "contacted", "interview-scheduled", "interviewed", "selected", "rejected", "enrolled"] as const)
        .filter((s) => s !== lead.stage)
        .map((s) => ({ label: STAGE_LABEL[s], onClick: () => mover.move(lead.id, s), disabled: lead.stage === "enrolled" }))}
      trigger={(p) => (
        <Button variant="secondary" iconRight="chevronDown" {...p} disabled={lead.stage === "enrolled"} title={lead.stage === "enrolled" ? "Enrolled leads stay in Enrolled" : undefined}>
          Move to
        </Button>
      )}
    />
  );

  return (
    <SidePanel
      open
      title={lead.name}
      description={
        <span className="row" style={{ marginTop: 6 }}>
          <StatusChip status={lead.stage} />
          {due ? <StatusChip status="follow-up-due" /> : null}
        </span>
      }
      // Escape and scrim clicks belong to a stage dialog while one is open.
      onClose={() => {
        if (!mover.busy) onClose();
      }}
      footer={
        <>
          {lead.stage !== "enrolled" ? stageMenu : null}
          {open ? (
            <Button variant="danger" onClick={() => mover.move(lead.id, "rejected")}>
              Reject
            </Button>
          ) : null}
          {next ? (
            <Button icon={next.stage === "interview-scheduled" ? "calendar" : next.stage === "enrolled" ? "graduation" : undefined} onClick={() => mover.move(lead.id, next.stage)}>
              {next.label}
            </Button>
          ) : lead.stage === "enrolled" && lead.studentId && canSeeStudent ? (
            <Link to={`/admin/students/${lead.studentId}`} className="bl-btn bl-btn-primary" style={{ textDecoration: "none" }}>
              Open student profile
            </Link>
          ) : null}
        </>
      }
    >
      <MetaList
        items={[
          { label: "Email", value: <a href={`mailto:${lead.email}`}>{lead.email}</a> },
          { label: "Phone", value: <a href={`tel:${lead.phone.replace(/\s/g, "")}`}>{lead.phone}</a>, mono: true },
          { label: "Course of interest", value: course?.title || "—" },
          { label: "Source", value: lead.source },
          { label: "City", value: lead.city || "—" },
          { label: "Lead since", value: formatDate(lead.createdAt) },
          ...(batch ? [{ label: "Batch", value: `${batch.code} · ${batch.name}` }] : []),
        ]}
      />

      {lead.stage === "interview-scheduled" && lead.interviewAt ? (
        <Banner
          tone={new Date(lead.interviewAt).getTime() < now ? "warning" : "info"}
          icon="calendar"
          title={new Date(lead.interviewAt).getTime() < now ? "Interview time has passed" : "Interview booked"}
          action={
            <Button variant="secondary" onClick={() => mover.scheduleInterview(lead.id)}>
              Reschedule
            </Button>
          }
        >
          {interviewWhen(lead.interviewAt)}
          {new Date(lead.interviewAt).getTime() < now ? ". Record the outcome: Move to Interviewed, Select or Reject." : ""}
        </Banner>
      ) : null}
      {lead.stage === "rejected" && lead.rejectionReason ? <Banner tone="neutral" title="Rejected">{lead.rejectionReason}</Banner> : null}

      {open ? (
        <section className="adm-panel-section">
          <h3>Owner and follow-up</h3>
          <div className="bl-grid-2">
            <SelectField
              label="Owner"
              value={lead.ownerId || ""}
              onChange={(e) => void run(() => assignLead(lead.id, e.target.value || undefined), e.target.value ? "Lead assigned" : "Lead unassigned")}
              options={[{ value: "", label: "Unassigned" }, ...staffOptions(db, ["admissions", "super-admin"])]}
            />
            <TextField
              label="Follow-up date"
              type="date"
              value={lead.followUpOn || ""}
              onChange={(e) => void run(() => setFollowUp(lead.id, e.target.value || undefined))}
              hint={lead.followUpOn ? (overdue ? `Overdue since ${formatDayMonth(lead.followUpOn)}` : due ? "Due today" : undefined) : "No follow-up set"}
            />
          </div>
          {lead.followUpOn ? (
            <div>
              <Button variant="ghost" icon="x" onClick={() => void run(() => setFollowUp(lead.id, undefined), "Follow-up cleared")}>
                Clear follow-up
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="adm-panel-section">
        <h3>Add to history</h3>
        <SegmentedControl
          label="Entry type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "note", label: "Note", icon: "note" },
            { value: "call", label: "Call", icon: "phone" },
          ]}
        />
        <TextAreaField
          label={kind === "call" ? "Call summary" : "Note"}
          rows={3}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (noteError) setNoteError(undefined);
          }}
          error={noteError}
          placeholder={kind === "call" ? "What was discussed, what happens next" : "Anything the team should know"}
        />
        <div>
          <Button variant="secondary" icon={kind === "call" ? "phone" : "note"} disabled={savingNote} onClick={() => void saveNote()}>
            {kind === "call" ? "Log call" : "Add note"}
          </Button>
        </div>
      </section>

      <section className="adm-panel-section">
        <h3>History</h3>
        <ActivityTimeline lead={lead} now={now} />
      </section>
    </SidePanel>
  );
}
