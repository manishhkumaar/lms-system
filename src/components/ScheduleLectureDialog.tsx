import { useEffect, useMemo, useState } from "react";
import { ActionError, rescheduleLecture, scheduleLecture } from "@/data/actions";
import { useDb } from "@/data/store";
import { batchLectures, getBatch, getCourse, lectureLabel, seatsFilled } from "@/data/selectors";
import type { ID, Lecture } from "@/data/types";
import { Banner, Button, Checkbox, Dialog, SelectField, TextAreaField, TextField, useToast } from "@/design-system";
import { formatWhen, plural } from "@/lib/format";
import { addDays, dateKey, DEFAULT_TZ, timeKey, weekdayOf, zoneOptions } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { scheduleBatchOptions } from "./options";
import { errorMessage } from "./useRun";

export interface ScheduleLectureDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fix the batch (Batch Details); otherwise the dialog asks for it. */
  batchId?: ID;
  /** Reschedule this lecture instead of creating one. */
  lecture?: Lecture;
  /** Prefill the date (YYYY-MM-DD), e.g. from a calendar day. */
  defaultDate?: string;
  onDone?: (lecture: Lecture | undefined) => void;
}

/** Schedule lecture / Reschedule lecture. Every time carries its zone. */
export function ScheduleLectureDialog({ open, onClose, batchId: fixedBatch, lecture, defaultDate, onDone }: ScheduleLectureDialogProps) {
  const db = useDb();
  const now = useNow(60000);
  const toast = useToast();
  const isReschedule = !!lecture;
  const [batchId, setBatchId] = useState<ID>(lecture?.batchId || fixedBatch || "");
  const batch = getBatch(db, batchId);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [start, setStart] = useState("18:30");
  const [end, setEnd] = useState("20:00");
  const [link, setLink] = useState("");
  const [publish, setPublish] = useState(true);
  const [agenda, setAgenda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Next unscheduled template title for the batch's course.
  const suggestion = useMemo(() => {
    if (!batch) return "";
    const course = getCourse(db, batch.courseId);
    const used = new Set(batchLectures(db, batch.id).map((l) => l.title));
    return course?.modules.flatMap((m) => m.lectures).find((t) => !used.has(t.title))?.title || "";
  }, [db, batch]);

  // Next batch day after the last lecture, or today.
  const suggestedDate = useMemo(() => {
    if (!batch) return dateKey(new Date(now), DEFAULT_TZ);
    const last = batchLectures(db, batch.id).slice(-1)[0];
    let d = last ? addDays(dateKey(last.start, batch.timeZone), 1) : batch.startDate;
    const today = dateKey(new Date(now), batch.timeZone);
    if (d < today) d = today;
    for (let i = 0; i < 7 && batch.days.length && !batch.days.includes(weekdayOf(d)); i++) d = addDays(d, 1);
    return d;
  }, [db, batch, now]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (lecture) {
      setBatchId(lecture.batchId);
      setTitle(lecture.title);
      setTz(lecture.timeZone);
      setDate(dateKey(lecture.start, lecture.timeZone));
      setStart(timeKey(lecture.start, lecture.timeZone));
      setEnd(timeKey(lecture.end, lecture.timeZone));
    } else {
      const b = getBatch(db, fixedBatch || batchId);
      setBatchId(b?.id || "");
      setTz(b?.timeZone || DEFAULT_TZ);
      setStart(b?.slotStart || "18:30");
      setEnd(b?.slotEnd || "20:00");
      setLink("");
      setAgenda("");
      setPublish(true);
    }
    // Only when the dialog opens.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || lecture) return;
    setTitle(suggestion);
    setDate(defaultDate || suggestedDate);
    if (batch) {
      setTz(batch.timeZone);
      setStart(batch.slotStart);
      setEnd(batch.slotEnd);
    }
  }, [open, batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const students = batch ? seatsFilled(db, batch.id) : 0;
  const nextNumber = batch ? Math.max(0, ...batchLectures(db, batch.id).map((l) => l.number)) + 1 : 1;

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!batchId) throw new ActionError("Choose a batch.");
      if (isReschedule) {
        const l = await rescheduleLecture(lecture!.id, { date, startTime: start, endTime: end, timeZone: tz });
        toast({ title: "Lecture rescheduled", description: `${plural(students, "student")} in ${batch?.code} will be notified. The meeting link moved with it.`, tone: "success" });
        onDone?.(l);
      } else {
        if (!title.trim()) throw new ActionError("Enter a lecture title.");
        const l = await scheduleLecture({ batchId, title, date, startTime: start, endTime: end, timeZone: tz, meetingUrl: link || undefined, publish: publish && !!link, agenda: agenda || undefined, instructor: batch?.instructors[0] });
        toast({
          title: "Lecture scheduled",
          description: `${batch?.code} ${lectureLabel(l)} · ${formatWhen(l.start, l.end, l.timeZone)}${l.linkPublished ? "" : ". Publish the meeting link before it starts."}`,
          tone: "success",
        });
        onDone?.(l);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const desc = isReschedule ? `${batch?.name} · ${lectureLabel(lecture!)} · ${lecture!.title}` : batch ? `${batch.name} · Lecture ${nextNumber}` : "Add a live session to a batch";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isReschedule ? "Reschedule lecture" : "Schedule lecture"}
      description={desc}
      width={560}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (isReschedule ? "Rescheduling…" : "Scheduling…") : isReschedule ? "Reschedule lecture" : "Schedule lecture"}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {!fixedBatch && !isReschedule ? <SelectField label="Batch" required placeholder="Choose a batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} options={scheduleBatchOptions(db, now)} /> : null}
      {!isReschedule ? <TextField label="Lecture title" required value={title} onChange={(e) => setTitle(e.target.value)} hint={suggestion && title !== suggestion ? `Next in the course: ${suggestion}` : undefined} /> : null}
      <div className="bl-grid-2">
        <TextField label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <SelectField label="Time zone" value={tz} onChange={(e) => setTz(e.target.value)} options={zoneOptions()} />
      </div>
      <div className="bl-grid-2">
        <TextField label="Starts" type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
        <TextField label="Ends" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {isReschedule ? (
        <Banner tone="warning">
          {plural(students, "student")} in this batch will be notified. The meeting link moves with the lecture{lecture?.linkPublished ? "" : " once it's published"}.
        </Banner>
      ) : (
        <>
          <TextField label="Meeting link" mono placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} hint="Optional now. Join stays disabled for students until a link is published." />
          {link ? <Checkbox label="Publish link to students now" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> : null}
          <TextAreaField label="Agenda" rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="What this session covers (optional)" />
        </>
      )}
    </Dialog>
  );
}
