import { useEffect, useState } from "react";
import { errorMessage } from "@/components/useRun";
import { addLectureTemplate, updateLectureTemplate } from "@/data/actions";
import type { ID, LectureTemplate } from "@/data/types";
import { Banner, Button, Dialog, TextAreaField, TextField, useToast } from "@/design-system";
import { formatDuration } from "@/lib/format";

/** Add lecture / Edit lecture: one lecture template in a module. Batches create a live lecture from each. */
export function TemplateDialog({
  open,
  onClose,
  courseId,
  moduleId,
  moduleTitle,
  template,
}: {
  open: boolean;
  onClose: () => void;
  courseId: ID;
  moduleId: ID;
  moduleTitle: string;
  template?: LectureTemplate;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [mins, setMins] = useState("90");
  const [summary, setSummary] = useState("");
  const [errors, setErrors] = useState<{ title?: string; mins?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(template?.title || "");
    setMins(String(template?.durationMins || 90));
    setSummary(template?.summary || "");
    setErrors({});
    setFormError(null);
  }, [open, template]);

  const submit = async () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Enter the lecture title.";
    const m = Number(mins);
    if (!Number.isInteger(m) || m < 15 || m > 480) next.mins = "Enter a length between 15 and 480 minutes.";
    setErrors(next);
    if (next.title || next.mins) return;
    setFormError(null);
    setBusy(true);
    try {
      if (template) {
        // An empty summary clears it.
        await updateLectureTemplate(courseId, moduleId, template.id, { title: title.trim(), durationMins: m, summary: summary.trim() });
        toast({ title: "Lecture updated", description: "Batches already scheduled keep their existing lectures.", tone: "success" });
      } else {
        await addLectureTemplate(courseId, moduleId, { title: title.trim(), durationMins: m, summary: summary.trim() || undefined });
        toast({ title: "Lecture added", description: moduleTitle, tone: "success" });
      }
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const m = Number(mins);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={template ? "Edit lecture" : "Add lecture"}
      description={`Lecture template in ${moduleTitle}`}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {template ? "Save lecture" : "Add lecture"}
          </Button>
        </>
      }
    >
      {formError ? <Banner tone="danger">{formError}</Banner> : null}
      <TextField label="Lecture title" required value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. REST APIs with Express" />
      <TextField label="Length (minutes)" type="number" min={15} step={15} required value={mins} error={errors.mins} hint={m >= 15 ? formatDuration(m) : undefined} onChange={(e) => setMins(e.target.value)} />
      <TextAreaField label="Summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} hint="Optional. Becomes the agenda when a batch schedules this lecture." />
    </Dialog>
  );
}
