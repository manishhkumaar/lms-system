import { useEffect, useState, type FormEvent } from "react";
import { useRun } from "@/components/useRun";
import { updateCourse } from "@/data/actions";
import type { Course } from "@/data/types";
import { Button, Card, SelectField, TextAreaField, TextField } from "@/design-system";
import { formatINR } from "@/lib/format";
import { LEVELS } from "./courseBits";

type Errors = Partial<Record<"title" | "weeks" | "fee" | "summary", string>>;

export function DetailsTab({ course, hasBatches }: { course: Course; hasBatches: boolean }) {
  const run = useRun();
  const [title, setTitle] = useState(course.title);
  const [summary, setSummary] = useState(course.summary);
  const [level, setLevel] = useState(course.level);
  const [weeks, setWeeks] = useState(String(course.durationWeeks));
  const [fee, setFee] = useState(String(course.fee));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(course.title);
    setSummary(course.summary);
    setLevel(course.level);
    setWeeks(String(course.durationWeeks));
    setFee(String(course.fee));
    setErrors({});
  }, [course.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const feeValue = Number(fee.replace(/[^\d]/g, ""));
  const dirty = title !== course.title || summary !== course.summary || level !== course.level || weeks !== String(course.durationWeeks) || feeValue !== course.fee;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!title.trim()) next.title = "Enter the course title.";
    if (!summary.trim()) next.summary = "Add a summary students will see.";
    const w = Number(weeks);
    if (!Number.isInteger(w) || w < 1 || w > 104) next.weeks = "Enter the length in whole weeks, for example 8.";
    if (!fee.trim() || Number.isNaN(feeValue)) next.fee = "Enter the fee in rupees, for example 85000.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    await run(() => updateCourse(course.id, { title: title.trim(), summary: summary.trim(), level, durationWeeks: w, fee: feeValue }), "Changes saved");
    setBusy(false);
  };

  return (
    <Card title="Course details" description="What students and the admissions team see about this course.">
      <form className="stack" onSubmit={save} noValidate>
        <TextField label="Course title" required value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
        <div className="bl-grid-2">
          <TextField label="Code" mono readOnly value={course.code} hint={hasBatches ? "Batch codes use it, so it can't change." : "Set when the course was created."} />
          <SelectField label="Level" value={level} onChange={(e) => setLevel(e.target.value as Course["level"])} options={LEVELS} />
        </div>
        <div className="bl-grid-2">
          <TextField label="Duration (weeks)" type="number" min={1} required value={weeks} error={errors.weeks} onChange={(e) => setWeeks(e.target.value)} />
          <TextField
            label="Fee (₹)"
            inputMode="numeric"
            required
            value={fee}
            error={errors.fee}
            hint={!Number.isNaN(feeValue) && fee ? `${formatINR(feeValue)}. Changing it doesn't change fees already paid.` : undefined}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
        <TextAreaField label="Summary" required rows={5} value={summary} error={errors.summary} onChange={(e) => setSummary(e.target.value)} />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          {!dirty ? <span className="caption">No unsaved changes</span> : null}
          <Button type="submit" disabled={!dirty || busy}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
