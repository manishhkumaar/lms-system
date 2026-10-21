"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { errorMessage } from "@/components/useRun";
import { createBatch, sessionDates } from "@/data/actions";
import { useDb } from "@/data/store";
import { getCourse } from "@/data/selectors";
import type { Batch } from "@/data/types";
import { Banner, Button, Card, Checkbox, EmptyState, Icon, SelectField, TextField, useToast } from "@/design-system";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { formatDate, formatDayMonth, formatINR, plural } from "@/lib/format";
import { addDays, dateKey, tzLabel, zoneOptions } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { nextBatchNumber, WEEKDAYS } from "./batches/batchFormat";
import "./academics.css";

type Errors = Partial<Record<"course" | "number" | "startDate" | "days" | "slot" | "capacity", string>>;

/** New batch: one scheduled delivery of a course. A full page, not a dialog. */
export function BatchSetupPage() {
  const db = useDb();
  const user = useUser();
  const nav = useNavigate();
  const toast = useToast();
  const now = useNow(60000);
  const [params] = useSearchParams();
  const published = useMemo(() => db.courses.filter((c) => c.status === "published"), [db.courses]);
  const preset = params.get("course");

  const [courseId, setCourseId] = useState(() => (preset && published.some((c) => c.id === preset) ? preset : published[0]?.id || ""));
  const [number, setNumber] = useState(() => (courseId ? nextBatchNumber(db, courseId) : "01"));
  const [numberTouched, setNumberTouched] = useState(false);
  const [startDate, setStartDate] = useState(() => addDays(dateKey(new Date(), db.settings.defaultTimeZone), 14));
  const [days, setDays] = useState<Batch["days"]>(["Mon", "Wed", "Fri"]);
  const [slotStart, setSlotStart] = useState("18:30");
  const [slotEnd, setSlotEnd] = useState("20:00");
  const [tz, setTz] = useState(db.settings.defaultTimeZone);
  const [capacity, setCapacity] = useState("40");
  const [instructors, setInstructors] = useState("");
  const [generate, setGenerate] = useState(true);
  const [draft, setDraft] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const course = getCourse(db, courseId);
  useEffect(() => {
    if (courseId && !numberTouched) setNumber(nextBatchNumber(db, courseId));
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const templates = course?.modules.flatMap((m) => m.lectures) || [];
  const num = number.trim().padStart(2, "0");
  const code = course ? `${course.code}-${num}` : "";
  const codeTaken = !!code && db.batches.some((b) => b.code === code);
  const dates = useMemo(() => (startDate && days.length && templates.length ? sessionDates(startDate, days, templates.length) : []), [startDate, days, templates.length]);
  const today = dateKey(new Date(now), tz);

  const toggleDay = (d: Batch["days"][number], on: boolean) => setDays((xs) => (on ? WEEKDAYS.filter((w) => xs.includes(w) || w === d) : xs.filter((x) => x !== d)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!course) next.course = "Choose a published course.";
    if (!/^\d{1,2}$/.test(number.trim()) || Number(number) < 1) next.number = "Enter a batch number from 1 to 99, for example 09.";
    else if (codeTaken) next.number = `Batch ${code} already exists. Use ${course ? nextBatchNumber(db, course.id) : "another number"}.`;
    if (!startDate) next.startDate = "Choose the first day of the batch.";
    if (!days.length) next.days = "Choose at least one day of the week.";
    if (!slotStart || !slotEnd) next.slot = "Enter the usual start and end time.";
    else if (slotEnd <= slotStart) next.slot = "The end time must be after the start time.";
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) next.capacity = "Enter how many seats this batch has, from 1 to 500.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const b = await createBatch({
        courseId,
        number: num,
        startDate,
        capacity: cap,
        instructors: instructors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        timeZone: tz,
        days,
        slotStart,
        slotEnd,
        generateLectures: generate,
        draft,
      });
      toast({
        title: `${b.code} created`,
        description: draft ? "Saved as a draft. Open it for enrolment when the schedule is ready." : generate && templates.length ? `${plural(templates.length, "lecture")} scheduled. Publish each meeting link before it starts.` : "Schedule its lectures from Batch Details.",
        tone: "success",
      });
      nav(`/admin/batches/${b.id}`);
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  };

  const crumbs = <Crumbs items={[{ label: "Batches", to: "/admin/batches" }, { label: "New batch" }]} />;

  if (!published.length) {
    return (
      <AdminPage title="New batch" breadcrumb={crumbs}>
        <div className="bl-card">
          <EmptyState
            icon="book"
            title="Publish a course first"
            description="A batch is a scheduled delivery of a published course. Ask the Course Designer to publish one."
            action={
              canAccess(user.role, "courses") ? (
                <Button variant="secondary" onClick={() => nav("/admin/courses")}>
                  Go to courses
                </Button>
              ) : undefined
            }
          />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="New batch"
      breadcrumb={crumbs}
      actions={
        <Button type="submit" form="acd-batch-form" disabled={busy}>
          {busy ? "Creating…" : "Create batch"}
        </Button>
      }
    >
      <form id="acd-batch-form" className="acd-form" onSubmit={submit} noValidate>
        {formError ? <Banner tone="danger">{formError}</Banner> : null}

        <Card title="Course and batch" description="A student enrols in a batch, not a course.">
          <div className="stack">
            <SelectField
              label="Course"
              required
              value={courseId}
              error={errors.course}
              onChange={(e) => setCourseId(e.target.value)}
              options={published.map((c) => ({ value: c.id, label: `${c.title} · ${plural(c.modules.reduce((n, m) => n + m.lectures.length, 0), "lecture")} · ${formatINR(c.fee)}` }))}
              hint="Only published courses can have batches."
            />
            <div className="bl-grid-2">
              <TextField
                label="Batch number"
                required
                mono
                inputMode="numeric"
                maxLength={2}
                value={number}
                error={errors.number || (codeTaken ? `Batch ${code} already exists.` : undefined)}
                hint={code ? `Batch code ${code}` : undefined}
                onChange={(e) => {
                  setNumberTouched(true);
                  setNumber(e.target.value.replace(/\D/g, ""));
                }}
              />
              <TextField label="Capacity" type="number" min={1} required value={capacity} error={errors.capacity} hint="Seats available for enrolment" onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <TextField label="Instructors" value={instructors} onChange={(e) => setInstructors(e.target.value)} placeholder="e.g. Vivek Krishnan, Arvind Shetty" hint="Separate names with commas. The first leads each lecture by default." />
          </div>
        </Card>

        <Card title="Schedule" description="The usual slot. Each lecture can still be moved later.">
          <div className="stack">
            <div className="bl-grid-2">
              <TextField label="Start date" type="date" required value={startDate} error={errors.startDate} hint={startDate && startDate < today ? "This date is in the past." : undefined} onChange={(e) => setStartDate(e.target.value)} />
              <SelectField label="Time zone" value={tz} onChange={(e) => setTz(e.target.value)} options={zoneOptions()} hint="All lecture times are stored with this zone" />
            </div>
            <fieldset className="acd-fieldset">
              <legend>Days of the week</legend>
              <div className="acd-days">
                {WEEKDAYS.map((d) => (
                  <Checkbox key={d} label={d} checked={days.includes(d)} onChange={(e) => toggleDay(d, e.target.checked)} />
                ))}
              </div>
              {errors.days ? <span className="bl-field-error">{errors.days}</span> : null}
            </fieldset>
            <div className="bl-grid-2">
              <TextField label={`Starts (${tzLabel(tz)})`} type="time" required value={slotStart} onChange={(e) => setSlotStart(e.target.value)} error={errors.slot} />
              <TextField label={`Ends (${tzLabel(tz)})`} type="time" required value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card title="Lectures and enrolment">
          <div className="stack">
            <Checkbox
              label={`Create lectures from the course's ${plural(templates.length, "lecture template")}`}
              description="One live lecture per template, on the days and slot above. Meeting links are added later."
              checked={generate && templates.length > 0}
              disabled={!templates.length}
              onChange={(e) => setGenerate(e.target.checked)}
            />
            {generate && templates.length ? (
              <div className="acd-preview">
                <Icon name="calendar" />
                <span>
                  {dates.length ? (
                    <>
                      <strong>{plural(dates.length, "lecture")}</strong> from {formatDayMonth(dates[0])} to {formatDate(dates[dates.length - 1])}, {days.join(", ")} at <span className="bl-mono">{`${slotStart}–${slotEnd}`}</span> {tzLabel(tz)}.
                    </>
                  ) : (
                    "Choose a start date and days to preview the lecture dates."
                  )}
                </span>
              </div>
            ) : (
              <p className="caption">{templates.length ? "No lectures will be created. Schedule them one by one from Batch Details." : "This course has no lecture templates yet, so schedule lectures from Batch Details."}</p>
            )}
            <Checkbox label="Save as draft (not open for enrolment)" description="Admissions can't enrol students until you open it." checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          </div>
        </Card>

        <div className="acd-form-foot">
          <Button variant="secondary" onClick={() => nav("/admin/batches")}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create batch"}
          </Button>
        </div>
      </form>
    </AdminPage>
  );
}
