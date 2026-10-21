import { useEffect, useState } from "react";
import { errorMessage } from "@/components/useRun";
import { createCourse } from "@/data/actions";
import type { Course } from "@/data/types";
import { Banner, Button, Checkbox, Dialog, SelectField, TextAreaField, TextField, useToast } from "@/design-system";
import { formatINR } from "@/lib/format";
import { LEVELS } from "./courseBits";

type Errors = Partial<Record<"title" | "code" | "weeks" | "fee" | "summary", string>>;

function suggestCode(title: string) {
  return title
    .split(/[\s/&]+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !["and", "with", "of", "the", "for"].includes(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** New course: the short form. Modules and lecture templates are added in the Course Editor. */
export function NewCourseDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: Course) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [level, setLevel] = useState<Course["level"]>("Beginner");
  const [weeks, setWeeks] = useState("8");
  const [fee, setFee] = useState("");
  const [summary, setSummary] = useState("");
  const [materials, setMaterials] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCode("");
    setCodeTouched(false);
    setLevel("Beginner");
    setWeeks("8");
    setFee("");
    setSummary("");
    setMaterials(true);
    setErrors({});
    setFormError(null);
  }, [open]);

  const feeValue = Number(fee.replace(/[^\d]/g, ""));

  const submit = async () => {
    const next: Errors = {};
    if (!title.trim()) next.title = "Enter the course title.";
    if (!/^[A-Z]{2,5}$/.test(code.trim().toUpperCase())) next.code = "Use 2–5 letters, for example FSW.";
    const w = Number(weeks);
    if (!Number.isInteger(w) || w < 1 || w > 104) next.weeks = "Enter the length in whole weeks, for example 8.";
    if (!fee.trim() || Number.isNaN(feeValue)) next.fee = "Enter the fee in rupees, for example 85000.";
    if (!summary.trim()) next.summary = "Add a one- or two-sentence summary students will see.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const c = await createCourse({ code, title, summary, level, durationWeeks: w, fee: feeValue, materialsEnabled: materials });
      toast({ title: "Course created", description: "Add modules and lecture templates, then publish it.", tone: "success" });
      onCreated(c);
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New course"
      description="The reusable curriculum. Batches are scheduled deliveries of it."
      width={560}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create course"}
          </Button>
        </>
      }
    >
      {formError ? <Banner tone="danger">{formError}</Banner> : null}
      <TextField
        label="Course title"
        required
        value={title}
        error={errors.title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (!codeTouched) setCode(suggestCode(e.target.value));
        }}
        placeholder="e.g. Full-Stack Web Development"
      />
      <div className="bl-grid-2">
        <TextField
          label="Code"
          required
          mono
          maxLength={5}
          value={code}
          error={errors.code}
          hint={code ? `Batches will be named ${code.toUpperCase()}-01, ${code.toUpperCase()}-02…` : "Used in batch codes, e.g. FSW-07"}
          onChange={(e) => {
            setCodeTouched(true);
            setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""));
          }}
        />
        <SelectField label="Level" value={level} onChange={(e) => setLevel(e.target.value as Course["level"])} options={LEVELS} />
      </div>
      <div className="bl-grid-2">
        <TextField label="Duration (weeks)" type="number" min={1} required value={weeks} error={errors.weeks} onChange={(e) => setWeeks(e.target.value)} />
        <TextField label="Fee (₹)" inputMode="numeric" required value={fee} error={errors.fee} hint={fee && !Number.isNaN(feeValue) ? formatINR(feeValue) : undefined} onChange={(e) => setFee(e.target.value)} />
      </div>
      <TextAreaField label="Summary" required rows={3} value={summary} error={errors.summary} onChange={(e) => setSummary(e.target.value)} />
      <Checkbox label="Learning materials on" description="Students see notes, slides and files for this course. You can change this later." checked={materials} onChange={(e) => setMaterials(e.target.checked)} />
    </Dialog>
  );
}
