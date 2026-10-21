import { useEffect, useState } from "react";
import { errorMessage } from "@/components/useRun";
import { addMaterial, updateMaterial } from "@/data/actions";
import { useDb } from "@/data/store";
import { getCourse } from "@/data/selectors";
import type { ID, Material, MaterialKind } from "@/data/types";
import { Banner, Button, Dialog, SelectField, TextAreaField, TextField, useToast } from "@/design-system";
import { formatNumber } from "@/lib/format";
import { KIND_OPTIONS } from "./courseBits";

export interface MaterialDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fix the course (Course Editor). */
  courseId?: ID;
  /** Edit this material instead of adding one. */
  material?: Material;
}

type Errors = Partial<Record<"title" | "body" | "url" | "file" | "course", string>>;

function sizeLabel(kb?: number) {
  if (!kb) return "";
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${formatNumber(kb)} KB`;
}

/** Add material / Edit material: notes, slides, PDFs and links for a course or one of its modules. */
export function MaterialDialog({ open, onClose, courseId: fixedCourse, material }: MaterialDialogProps) {
  const db = useDb();
  const toast = useToast();
  const [courseId, setCourseId] = useState<ID>("");
  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MaterialKind>("notes");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    setFile(null);
    if (material) {
      setCourseId(material.courseId);
      setModuleId(material.moduleId || "");
      setTitle(material.title);
      setKind(material.kind);
      setBody(material.body || "");
      setUrl(material.url || "");
    } else {
      setCourseId(fixedCourse || db.courses[0]?.id || "");
      setModuleId("");
      setTitle("");
      setKind("notes");
      setBody("");
      setUrl("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const course = getCourse(db, courseId);
  const isFile = kind === "pdf" || kind === "slides";
  const keepsFile = !!material && material.kind === kind && isFile && !!material.fileName;

  const submit = async () => {
    const next: Errors = {};
    if (!course) next.course = "Choose the course this material belongs to.";
    if (!title.trim()) next.title = "Enter a title students will recognise.";
    if (kind === "notes" && !body.trim()) next.body = "Write the notes, or choose another kind.";
    if (kind === "link" && !/^https:\/\/\S+\.\S+/.test(url.trim())) next.url = "Enter a full link starting with https://";
    if (isFile && !file && !keepsFile) next.file = "Choose the file to upload.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    const payload: Omit<Material, "id" | "updatedAt" | "filePath"> = {
      courseId,
      moduleId: moduleId || undefined,
      title: title.trim(),
      kind,
      body: kind === "notes" ? body.trim() : undefined,
      url: kind === "link" ? url.trim() : undefined,
      fileName: isFile ? file?.name || material?.fileName : undefined,
      sizeKb: isFile ? (file ? Math.max(1, Math.round(file.size / 1024)) : material?.sizeKb) : undefined,
    };
    setBusy(true);
    try {
      // A chosen file is uploaded to storage by the action before the material is saved.
      const upload = isFile && file ? file : undefined;
      if (material) {
        await updateMaterial(material.id, payload, upload);
        toast({ title: "Material updated", tone: "success" });
      } else {
        await addMaterial(payload, upload);
        toast({
          title: "Material added",
          description: course?.materialsEnabled ? `Students in ${course.title} batches can see it now.` : `Materials are off for ${course?.title}, so students won't see it until you turn them on.`,
          tone: course?.materialsEnabled ? "success" : "warning",
        });
      }
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
      title={material ? "Edit material" : "Add material"}
      description={course ? course.title : "Notes, slides, PDFs and links for a course"}
      width={560}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (isFile && file ? "Uploading…" : "Saving…") : material ? "Save material" : "Add material"}
          </Button>
        </>
      }
    >
      {formError ? <Banner tone="danger">{formError}</Banner> : null}
      {!fixedCourse ? (
        <SelectField
          label="Course"
          required
          value={courseId}
          error={errors.course}
          onChange={(e) => {
            setCourseId(e.target.value);
            setModuleId("");
          }}
          options={db.courses.map((c) => ({ value: c.id, label: c.title }))}
        />
      ) : null}
      <div className="bl-grid-2">
        <SelectField label="Module" value={moduleId} onChange={(e) => setModuleId(e.target.value)} options={[{ value: "", label: "Whole course" }, ...(course?.modules.map((m) => ({ value: m.id, label: m.title })) || [])]} />
        <SelectField label="Kind" value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)} options={KIND_OPTIONS} />
      </div>
      <TextField label="Title" required value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. REST APIs with Express: lecture notes" />
      {kind === "notes" ? <TextAreaField label="Notes" required rows={8} value={body} error={errors.body} onChange={(e) => setBody(e.target.value)} hint="Leave a blank line between paragraphs." /> : null}
      {kind === "link" ? <TextField label="Link" mono required placeholder="https://…" value={url} error={errors.url} onChange={(e) => setUrl(e.target.value)} /> : null}
      {isFile ? (
        <TextField
          label={keepsFile ? "Replace file" : "File"}
          type="file"
          accept={kind === "pdf" ? ".pdf" : ".pdf,.ppt,.pptx,.key"}
          required={!keepsFile}
          error={errors.file}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          hint={file ? `${file.name} · ${sizeLabel(Math.round(file.size / 1024))}` : keepsFile ? `Current file: ${material!.fileName} · ${sizeLabel(material!.sizeKb)}` : kind === "pdf" ? "PDF up to 50 MB" : "PDF or PowerPoint up to 50 MB"}
        />
      ) : null}
    </Dialog>
  );
}

export { sizeLabel };
