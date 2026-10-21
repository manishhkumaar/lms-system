import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { EnrolDialog } from "@/components/EnrolDialog";
import { errorMessage, useRun } from "@/components/useRun";
import { ActionError, addLeadNote, moveLead, updateLead } from "@/data/actions";
import { useDb } from "@/data/store";
import { getCourse, getLead } from "@/data/selectors";
import type { ID, LeadStage } from "@/data/types";
import { Banner, Button, Dialog, SelectField, TextAreaField, TextField, useToast } from "@/design-system";
import { formatShortWhen } from "@/lib/format";
import { addDays, dateKey, DEFAULT_TZ, timeKey, zonedISO, zoneOptions } from "@/lib/time";
import { REJECT_REASONS, shortCourse, STAGE_LABEL } from "./leadUtils";

/**
 * Schedule interview (moves the lead to Interview scheduled) or Reschedule interview when the lead
 * is already there. Without a leadId it asks which New or Contacted lead to interview.
 */
export function InterviewDialog({ open, onClose, leadId }: { open: boolean; onClose: () => void; leadId?: ID }) {
  const db = useDb();
  const toast = useToast();
  const fixed = getLead(db, leadId);
  const reschedule = fixed?.stage === "interview-scheduled";
  const [pick, setPick] = useState<ID>("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("11:00");
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () =>
      db.leads
        .filter((l) => l.stage === "new" || l.stage === "contacted")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((l) => ({ value: l.id, label: `${l.name} · ${shortCourse(getCourse(db, l.courseId)?.title)} · ${STAGE_LABEL[l.stage]}` })),
    [db],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNote("");
    setTz(DEFAULT_TZ);
    setPick(leadId || candidates[0]?.value || "");
    if (reschedule && fixed?.interviewAt) {
      setDate(dateKey(fixed.interviewAt, DEFAULT_TZ));
      setTime(timeKey(fixed.interviewAt, DEFAULT_TZ));
    } else {
      setDate(addDays(dateKey(new Date(), DEFAULT_TZ), 1));
      setTime("11:00");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const lead = fixed || getLead(db, pick);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!lead) throw new ActionError("Choose the lead to interview.");
      if (!date || !time) throw new ActionError("Choose the interview date and time.");
      const at = zonedISO(date, time, tz);
      if (new Date(at).getTime() < Date.now()) throw new ActionError("Choose a time in the future.");
      if (reschedule) {
        await updateLead(lead.id, { interviewAt: at });
        await addLeadNote(lead.id, `Interview rescheduled to ${formatShortWhen(at, tz)}`, "interview");
        if (note.trim()) await addLeadNote(lead.id, note.trim());
      } else {
        await moveLead(lead.id, "interview-scheduled", { interviewAt: at, note: note.trim() || undefined });
      }
      toast({ title: reschedule ? "Interview rescheduled" : "Interview scheduled", description: `${lead.name} · ${formatShortWhen(at, tz)}`, tone: "success" });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const title = reschedule ? "Reschedule interview" : "Schedule interview";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={lead ? `${lead.name} · ${getCourse(db, lead.courseId)?.title}` : "Book a 30-minute admissions interview."}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!lead || busy}>
            {busy ? "Saving…" : title}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {!fixed ? (
        candidates.length ? (
          <SelectField label="Lead" required value={pick} onChange={(e) => setPick(e.target.value)} options={candidates} hint="Leads in New or Contacted." />
        ) : (
          <Banner tone="neutral">No leads in New or Contacted to interview.</Banner>
        )
      ) : null}
      <div className="bl-grid-2">
        <TextField label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} hint="30-minute slot" />
      </div>
      <SelectField label="Time zone" value={tz} onChange={(e) => setTz(e.target.value)} options={zoneOptions()} />
      <TextAreaField label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Interviewer, call or video, anything to prepare (optional)" />
    </Dialog>
  );
}

/** Reject lead, with the reason recorded on the lead. */
export function RejectDialog({ open, onClose, leadId }: { open: boolean; onClose: () => void; leadId?: ID }) {
  const db = useDb();
  const toast = useToast();
  const lead = getLead(db, leadId);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setReason(REJECT_REASONS[0]);
    setOther("");
    setError(null);
  }, [open]);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!lead) throw new ActionError("That lead no longer exists.");
      const why = reason === "other" ? other.trim() : reason;
      if (!why) throw new ActionError("Write the reason for rejecting.");
      await moveLead(lead.id, "rejected", { reason: why });
      toast({ title: "Lead rejected", description: `${lead.name}: ${why}`, tone: "success" });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reject lead"
      description={lead ? `Reject ${lead.name} for ${getCourse(db, lead.courseId)?.title}? You can reopen the lead later.` : undefined}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep lead
          </Button>
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? "Rejecting…" : "Reject lead"}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <SelectField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={[...REJECT_REASONS, { value: "other", label: "Other reason" }]} />
      {reason === "other" ? <TextField label="Other reason" required value={other} onChange={(e) => setOther(e.target.value)} /> : null}
    </Dialog>
  );
}

export interface LeadStageMover {
  /** Moves a lead, opening the dialog a stage needs (interview time, batch, rejection reason). */
  move: (leadId: ID, stage: LeadStage) => void;
  /** Schedule (or reschedule) an interview; without a lead, the dialog asks which. */
  scheduleInterview: (leadId?: ID) => void;
  /** True while one of the stage dialogs is open. */
  busy: boolean;
  dialogs: ReactNode;
}

/** One place for stage rules, used by the Kanban, the lead panel and Interviews. */
export function useLeadStageMover(): LeadStageMover {
  const db = useDb();
  const run = useRun();
  const toast = useToast();
  const [interview, setInterview] = useState<{ leadId?: ID } | null>(null);
  const [rejectId, setRejectId] = useState<ID | null>(null);
  const [enrolId, setEnrolId] = useState<ID | null>(null);

  const move = useCallback(
    (leadId: ID, stage: LeadStage) => {
      const lead = getLead(db, leadId);
      if (!lead || lead.stage === stage) return;
      if (lead.stage === "enrolled") {
        toast({ title: `${lead.name} is already enrolled`, description: "Enrolled leads stay in Enrolled. To change their batch, transfer them from their student profile.", tone: "warning" });
        return;
      }
      if (stage === "interview-scheduled") return setInterview({ leadId });
      if (stage === "enrolled") return setEnrolId(leadId);
      if (stage === "rejected") return setRejectId(leadId);
      void run(() => moveLead(leadId, stage), `Moved to ${STAGE_LABEL[stage]}`, lead.name);
    },
    [db, run, toast],
  );

  const scheduleInterview = useCallback((leadId?: ID) => setInterview({ leadId }), []);

  const dialogs = (
    <>
      <InterviewDialog open={!!interview} leadId={interview?.leadId} onClose={() => setInterview(null)} />
      <RejectDialog open={!!rejectId} leadId={rejectId || undefined} onClose={() => setRejectId(null)} />
      <EnrolDialog open={!!enrolId} leadId={enrolId || undefined} onClose={() => setEnrolId(null)} />
    </>
  );

  return { move, scheduleInterview, busy: !!interview || !!rejectId || !!enrolId, dialogs };
}
