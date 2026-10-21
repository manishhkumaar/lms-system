import { useEffect, useState } from "react";
import { useUser } from "@/auth/AuthContext";
import { courseOptions, LEAD_SOURCES, staffOptions } from "@/components/options";
import { errorMessage } from "@/components/useRun";
import { addLead } from "@/data/actions";
import { useDb } from "@/data/store";
import type { LeadSource, LeadStage } from "@/data/types";
import { Banner, Button, Dialog, SelectField, TextAreaField, TextField, useToast } from "@/design-system";
import { formatPhone, isValidEmail, isValidPhone, STAGE_LABEL } from "./leadUtils";

type Errors = Partial<Record<"name" | "email" | "phone" | "courseId", string>>;

/** Add lead. New leads start in New or Contacted; later stages need their own details. */
export function AddLeadDialog({ open, onClose, stage, onAdded }: { open: boolean; onClose: () => void; stage?: string; onAdded?: (id: string) => void }) {
  const db = useDb();
  const user = useUser();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [courseId, setCourseId] = useState("");
  const [source, setSource] = useState<LeadSource>("Website");
  const [ownerId, setOwnerId] = useState("");
  const [initial, setInitial] = useState<LeadStage>("new");
  const [followUp, setFollowUp] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setPhone("");
    setCity("");
    setCourseId(db.courses.find((c) => c.status === "published")?.id || "");
    setSource("Website");
    setOwnerId(user.role === "admissions" ? user.id : "");
    setInitial(stage === "contacted" ? "contacted" : "new");
    setFollowUp("");
    setNote("");
    setErrors({});
    setFormError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (busy) return;
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter the lead's full name.";
    if (!isValidEmail(email)) next.email = "Enter an email address like name@example.in.";
    if (!isValidPhone(phone)) next.phone = "Enter a 10-digit mobile number.";
    if (!courseId) next.courseId = "Choose the course they're interested in.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    const dupe = db.leads.find((l) => l.email.toLowerCase() === email.trim().toLowerCase() || l.phone.replace(/\D/g, "").endsWith(phone.replace(/\D/g, "").slice(-10)));
    if (dupe) {
      setFormError(`${dupe.name} is already a lead with this email or phone (${STAGE_LABEL[dupe.stage]}). Open that lead instead.`);
      return;
    }
    setBusy(true);
    try {
      const lead = await addLead({ name, email, phone: formatPhone(phone), city, courseId, source, ownerId: ownerId || undefined, stage: initial, followUpOn: followUp || undefined, note: note.trim() || undefined });
      toast({ title: "Lead added", description: `${lead.name} is in ${STAGE_LABEL[lead.stage]}.`, tone: "success" });
      onAdded?.(lead.id);
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
      title="Add lead"
      description="A prospective student for the admissions pipeline."
      width={600}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add lead"}
          </Button>
        </>
      }
    >
      {formError ? <Banner tone="warning">{formError}</Banner> : null}
      <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <div className="bl-grid-2">
        <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="Mobile number" type="tel" required placeholder="98480 12345" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
      </div>
      <div className="bl-grid-2">
        <SelectField label="Course of interest" required value={courseId} onChange={(e) => setCourseId(e.target.value)} options={courseOptions(db, { publishedOnly: true })} error={errors.courseId} />
        <SelectField label="Source" value={source} onChange={(e) => setSource(e.target.value as LeadSource)} options={[...LEAD_SOURCES]} />
      </div>
      <div className="bl-grid-2">
        <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <SelectField label="Owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} options={[{ value: "", label: "Unassigned" }, ...staffOptions(db, ["admissions", "super-admin"])]} />
      </div>
      <div className="bl-grid-2">
        <SelectField
          label="Stage"
          value={initial}
          onChange={(e) => setInitial(e.target.value as LeadStage)}
          options={[
            { value: "new", label: "New" },
            { value: "contacted", label: "Contacted" },
          ]}
          hint="Schedule an interview once the lead is added."
        />
        <TextField label="Follow-up date" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
      </div>
      <TextAreaField label="Note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What they asked about, preferred timings (optional)" />
    </Dialog>
  );
}
