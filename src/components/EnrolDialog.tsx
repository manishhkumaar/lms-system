"use client";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { ActionError, addStudent, enrolLead, enrolStudent, transferStudent } from "@/data/actions";
import { useDb } from "@/data/store";
import { getBatch, getCourse, getLead, getStudent } from "@/data/selectors";
import type { Enrolment, ID } from "@/data/types";
import { Banner, Button, CopyField, Dialog, SelectField, TextField, useToast } from "@/design-system";
import { formatINR } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { enrolBatchOptions } from "./options";
import { errorMessage } from "./useRun";

export interface EnrolDialogProps {
  open: boolean;
  onClose: () => void;
  /** Enrol a selected lead (creates the student). */
  leadId?: ID;
  /** Enrol an existing student in another batch. */
  studentId?: ID;
  /** Preselect a batch (from Batch Details). */
  batchId?: ID;
  onDone?: (studentId: ID) => void;
}

/**
 * Enrol student. A student enrols in a batch, not a course. With no lead or student given,
 * it adds a new student (walk-in) and enrols them.
 */
export function EnrolDialog({ open, onClose, leadId, studentId, batchId: preset, onDone }: EnrolDialogProps) {
  const db = useDb();
  const now = useNow(60000);
  const toast = useToast();
  const lead = getLead(db, leadId);
  const student = getStudent(db, studentId);
  const isNew = !lead && !student;
  const [batchId, setBatchId] = useState<ID>("");
  const [fee, setFee] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ studentId: ID; name: string; activationPath?: string; batch: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => {
    const exclude = student ? db.enrolments.filter((e) => e.studentId === student.id && e.status === "active").map((e) => e.batchId) : [];
    return enrolBatchOptions(db, now, lead?.courseId).filter((o) => !exclude.includes(o.value));
  }, [db, now, lead?.courseId, student]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDone(null);
    setName("");
    setEmail("");
    setPhone("");
    setCity("");
    const first = preset && options.some((o) => o.value === preset) ? preset : options[0]?.value || "";
    setBatchId(first);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const batch = getBatch(db, batchId);
  const course = getCourse(db, batch?.courseId);
  useEffect(() => {
    if (course) setFee(String(course.fee));
  }, [course?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (busy) return;
    setError(null);
    const batchName = batch?.name || "";
    setBusy(true);
    try {
      if (!batchId) throw new ActionError("Choose a batch with seats left.");
      const feePaid = Number(fee.replace(/[^\d]/g, ""));
      if (Number.isNaN(feePaid)) throw new ActionError("Enter the fee paid in rupees, or 0.");
      if (lead) {
        const res = await enrolLead(lead.id, batchId, feePaid);
        setDone({ studentId: res.student.id, name: res.student.name, activationPath: res.activationPath, batch: batchName });
        onDone?.(res.student.id);
      } else if (student) {
        await enrolStudent(student.id, batchId, feePaid);
        toast({ title: `${student.name} enrolled`, description: batchName, tone: "success" });
        onDone?.(student.id);
        onClose();
      } else {
        if (!name.trim()) throw new ActionError("Enter the student's full name.");
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new ActionError("Enter a valid email address.");
        if (phone.replace(/\D/g, "").length !== 10) throw new ActionError("Enter a 10-digit mobile number.");
        const res = await addStudent({ name, email, phone, city }, { batchId, feePaid });
        setDone({ studentId: res.student.id, name: res.student.name, activationPath: res.activationPath, batch: batchName });
        onDone?.(res.student.id);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={`${done.name} is enrolled`}
        description={done.batch}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Link to={`/admin/students/${done.studentId}`} className="bl-btn bl-btn-primary" style={{ textDecoration: "none" }} onClick={onClose}>
              Open student profile
            </Link>
          </>
        }
      >
        {done.activationPath ? (
          <Banner tone="success" title="Account invite ready">
            Send {done.name} the activation link below. Once they set a password, their batch, live classes and recordings appear as soon as they sign in.
          </Banner>
        ) : (
          <Banner tone="success" title="Already has an account">
            {done.name} will see this batch, its live classes and recordings the next time they sign in.
          </Banner>
        )}
        {done.activationPath ? (
          <div className="stack-1">
            <span className="bl-field-label">Activation link</span>
            <CopyField value={window.location.origin + done.activationPath} label="activation link" />
          </div>
        ) : null}
      </Dialog>
    );
  }

  const who = lead ? `${lead.name} · interested in ${getCourse(db, lead.courseId)?.title}` : student ? `${student.name} · ${student.email}` : "Add a student who didn't come through Leads";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isNew ? "Add student" : "Enrol student"}
      description={who}
      width={560}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!options.length || busy}>
            {busy ? "Enrolling…" : isNew ? "Add and enrol student" : "Enrol student"}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {isNew ? (
        <>
          <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
          <div className="bl-grid-2">
            <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Mobile number" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98480 12345" />
          </div>
          <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        </>
      ) : null}
      {options.length ? (
        <SelectField label="Batch" required value={batchId} onChange={(e) => setBatchId(e.target.value)} options={options} hint="Only batches open for enrolment with seats left are listed." />
      ) : (
        <Banner tone="warning" title="No batch has seats left">
          Create a batch or raise a batch's capacity in Batch Management, then enrol.
        </Banner>
      )}
      <TextField label="Fee paid (₹)" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} hint={course ? `Course fee ${formatINR(course.fee)}. Enter a part payment if paying in instalments.` : undefined} />
    </Dialog>
  );
}

/** Transfer student: move an active enrolment to another batch. */
export function TransferDialog({ open, onClose, enrolment }: { open: boolean; onClose: () => void; enrolment: Enrolment }) {
  const db = useDb();
  const now = useNow(60000);
  const toast = useToast();
  const student = getStudent(db, enrolment.studentId);
  const from = getBatch(db, enrolment.batchId);
  const options = useMemo(() => enrolBatchOptions(db, now, from?.courseId, enrolment.batchId), [db, now, from?.courseId, enrolment.batchId]);
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setTo(options[0]?.value || "");
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (busy) return;
    setError(null);
    const toCode = getBatch(db, to)?.code;
    setBusy(true);
    try {
      if (!to) throw new ActionError("Choose the batch to move to.");
      await transferStudent(enrolment.id, to);
      toast({ title: `${student?.name} transferred`, description: `From ${from?.code} to ${toCode}. Attendance so far stays with ${from?.code}.`, tone: "success" });
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
      title="Transfer student"
      description={`${student?.name} · currently in ${from?.name}`}
      width={560}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon="transfer" disabled={!options.length || busy}>
            {busy ? "Transferring…" : "Transfer student"}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {options.length ? <SelectField label="Move to batch" required value={to} onChange={(e) => setTo(e.target.value)} options={options} /> : <Banner tone="warning">No other batch has seats left.</Banner>}
      <p className="caption">Their verified attendance and recordings watched so far stay with {from?.code}. Fees carry over.</p>
    </Dialog>
  );
}
