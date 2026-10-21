import { useEffect, useState } from "react";
import { errorMessage } from "@/components/useRun";
import { updateBatch } from "@/data/actions";
import { useDb } from "@/data/store";
import { seatsFilled } from "@/data/selectors";
import type { Batch } from "@/data/types";
import { Banner, Button, Checkbox, Dialog, SelectField, TextField, useToast } from "@/design-system";
import { tzLabel, zoneOptions } from "@/lib/time";
import { WEEKDAYS } from "./batchFormat";

type Errors = Partial<Record<"capacity" | "days" | "slot", string>>;

/** Edit batch: capacity, instructors and the default slot. Scheduled lectures keep their times. */
export function EditBatchDialog({ open, onClose, batch }: { open: boolean; onClose: () => void; batch: Batch }) {
  const db = useDb();
  const toast = useToast();
  const filled = seatsFilled(db, batch.id);
  const [capacity, setCapacity] = useState("");
  const [instructors, setInstructors] = useState("");
  const [days, setDays] = useState<Batch["days"]>([]);
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [tz, setTz] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCapacity(String(batch.capacity));
    setInstructors(batch.instructors.join(", "));
    setDays(batch.days);
    setSlotStart(batch.slotStart);
    setSlotEnd(batch.slotEnd);
    setTz(batch.timeZone);
    setErrors({});
    setFormError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const next: Errors = {};
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) next.capacity = "Enter how many seats this batch has.";
    else if (cap < filled) next.capacity = `Capacity can't be below the ${filled} students already enrolled.`;
    if (!days.length) next.days = "Choose at least one day of the week.";
    if (!slotStart || !slotEnd || slotEnd <= slotStart) next.slot = "The end time must be after the start time.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setFormError(null);
    setBusy(true);
    try {
      await updateBatch(batch.id, {
        capacity: cap,
        instructors: instructors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        days,
        slotStart,
        slotEnd,
        timeZone: tz,
      });
      toast({ title: "Batch updated", description: `${batch.code} · ${filled} of ${cap} seats filled`, tone: "success" });
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
      title="Edit batch"
      description={`${batch.name} · ${batch.code}`}
      width={560}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save batch
          </Button>
        </>
      }
    >
      {formError ? <Banner tone="danger">{formError}</Banner> : null}
      <div className="bl-grid-2">
        <TextField label="Capacity" type="number" min={Math.max(1, filled)} required value={capacity} error={errors.capacity} hint={`${filled} enrolled now`} onChange={(e) => setCapacity(e.target.value)} />
        <SelectField label="Time zone" value={tz} onChange={(e) => setTz(e.target.value)} options={zoneOptions()} />
      </div>
      <TextField label="Instructors" value={instructors} onChange={(e) => setInstructors(e.target.value)} hint="Separate names with commas." />
      <fieldset className="acd-fieldset">
        <legend>Days of the week</legend>
        <div className="acd-days">
          {WEEKDAYS.map((d) => (
            <Checkbox key={d} label={d} checked={days.includes(d)} onChange={(e) => setDays((xs) => (e.target.checked ? WEEKDAYS.filter((w) => xs.includes(w) || w === d) : xs.filter((x) => x !== d)))} />
          ))}
        </div>
        {errors.days ? <span className="bl-field-error">{errors.days}</span> : null}
      </fieldset>
      <div className="bl-grid-2">
        <TextField label={`Usual start (${tzLabel(tz || batch.timeZone)})`} type="time" value={slotStart} error={errors.slot} onChange={(e) => setSlotStart(e.target.value)} />
        <TextField label={`Usual end (${tzLabel(tz || batch.timeZone)})`} type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
      </div>
      <p className="caption">The slot prefills new lectures. Lectures already scheduled keep their times; reschedule them from Lectures.</p>
    </Dialog>
  );
}
