"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTheme, type ThemeChoice } from "@/core/theme";
import { errorMessage, useRun } from "@/components/useRun";
import { updateSettings } from "@/data/actions";
import { useDb } from "@/data/store";
import type { OrgSettings } from "@/data/types";
import { Button, Card, SegmentedControl, SelectField, TextField, Toggle, useToast } from "@/design-system";
import { zoneOptions } from "@/lib/time";
import { AdminPage } from "@/layouts/AdminPage";
import "./overview.css";

type FormFields = Pick<OrgSettings, "orgName" | "supportEmail" | "defaultTimeZone" | "joinOpensMinutesBefore" | "linkReminderHours">;

const pickFields = (s: OrgSettings): FormFields => ({
  orgName: s.orgName,
  supportEmail: s.supportEmail,
  defaultTimeZone: s.defaultTimeZone,
  joinOpensMinutesBefore: s.joinOpensMinutesBefore,
  linkReminderHours: s.linkReminderHours,
});

const FORM_ID = "settings-form";

export function SettingsPage() {
  const db = useDb();
  const toast = useToast();
  const run = useRun();
  const [theme, setTheme] = useTheme();
  const [form, setForm] = useState<FormFields>(() => pickFields(db.settings));
  const [errors, setErrors] = useState<{ orgName?: string; supportEmail?: string }>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const saved = useMemo(() => pickFields(db.settings), [db.settings]);
  const dirty = (Object.keys(saved) as Array<keyof FormFields>).some((k) => saved[k] !== form[k]);

  // Pick up changes made elsewhere (another admin, another tab) while nothing is being edited.
  useEffect(() => {
    if (!dirty) setForm(saved);
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormFields>(k: K, v: FormFields[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    const next: typeof errors = {};
    if (!form.orgName.trim()) next.orgName = "Enter the name people see in the sidebar and emails.";
    if (!/^\S+@\S+\.\S+$/.test(form.supportEmail.trim())) next.supportEmail = "Enter a valid email address, like support@yourdomain.in";
    setErrors(next);
    if (next.orgName || next.supportEmail) return;
    setSaving(true);
    try {
      await updateSettings({ ...form, orgName: form.orgName.trim(), supportEmail: form.supportEmail.trim() });
      toast({ title: "Settings saved", tone: "success" });
    } catch (err) {
      toast({ title: errorMessage(err), tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage
      title="Settings"
      breadcrumb="Admin / Settings"
      actions={
        <Button type="submit" form={FORM_ID} disabled={!dirty || saving}>
          {saving ? "Saving…" : dirty ? "Save changes" : "All changes saved"}
        </Button>
      }
    >
      <form id={FORM_ID} className="ovw-settings" onSubmit={(e) => void save(e)} noValidate>
        <Card title="Organisation" description="Shown in the sidebar, sign-in screens and emails.">
          <div className="ovw-form-grid">
            <TextField label="Organisation name" required value={form.orgName} onChange={(e) => set("orgName", e.target.value)} error={errors.orgName} />
            <TextField label="Support email" type="email" required value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} error={errors.supportEmail} hint="Students see this when something goes wrong" />
            <SelectField
              label="Default time zone"
              value={form.defaultTimeZone}
              onChange={(e) => set("defaultTimeZone", e.target.value)}
              options={zoneOptions()}
              hint="New batches and new accounts start in this zone. Each lecture keeps its own zone."
            />
          </div>
        </Card>

        <Card title="Live classes" description="How Join behaves for students, and when Operations is reminded.">
          <div className="ovw-form-grid">
            <SelectField
              label="Join opens before start"
              value={String(form.joinOpensMinutesBefore)}
              onChange={(e) => set("joinOpensMinutesBefore", Number(e.target.value))}
              options={[
                { value: "0", label: "At the start time" },
                { value: "5", label: "5 minutes before" },
                { value: "10", label: "10 minutes before" },
                { value: "15", label: "15 minutes before" },
              ]}
              hint="Until then students see a countdown and a disabled Join button that says when it opens."
            />
            <SelectField
              label="Remind Operations about missing links"
              value={String(form.linkReminderHours)}
              onChange={(e) => set("linkReminderHours", Number(e.target.value))}
              options={[
                { value: "6", label: "6 hours before the lecture" },
                { value: "12", label: "12 hours before the lecture" },
                { value: "24", label: "24 hours before the lecture" },
                { value: "48", label: "48 hours before the lecture" },
              ]}
              hint="Lectures without a published link show up in Needs attention from this point."
            />
          </div>
        </Card>
      </form>

      <div className="ovw-settings">
        <Card title="Recordings">
          <Toggle
            label="Auto-publish recordings"
            description="Recordings go live to the batch as soon as they're uploaded"
            checked={db.settings.autoPublishRecordings}
            disabled={toggling}
            onChange={(on) => {
              setToggling(true);
              void run(() => updateSettings({ autoPublishRecordings: on }), on ? "Recordings will publish automatically" : "Recordings will wait for you to publish them").finally(() => setToggling(false));
            }}
          />
        </Card>

        <Card title="Appearance" description="Applies to this browser only.">
          <SegmentedControl<ThemeChoice>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light", icon: "sun" },
              { value: "dark", label: "Dark", icon: "moon" },
              { value: "system", label: "Match system", icon: "settings" },
            ]}
          />
        </Card>
      </div>
    </AdminPage>
  );
}
