"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@/lib/router";
import { useTheme, type ThemeChoice } from "@/core/theme";
import { useAuth } from "@/auth/AuthContext";
import { errorMessage, useRun } from "@/components/useRun";
import { changePassword, updateUser } from "@/data/actions";
import { getCourse, studentAttendance } from "@/data/selectors";
import { Avatar, Button, Card, MetaList, SegmentedControl, SelectField, TextField, useToast } from "@/design-system";
import { formatDate, plural } from "@/lib/format";
import { zoneOptions } from "@/lib/time";
import { StudentPage } from "@/layouts/StudentLayout";
import { useMe } from "./parts/useMe";
import "./student.css";

export function ProfilePage() {
  const { user, db, now, studentId, student, enrolments, batches, tz } = useMe();
  const { logout } = useAuth();
  const run = useRun();
  const toast = useToast();
  const [theme, setTheme] = useTheme();

  const [phone, setPhone] = useState(student?.phone || user.phone || "");
  const [phoneError, setPhoneError] = useState<string>();
  useEffect(() => setPhone(student?.phone || user.phone || ""), [student?.phone, user.phone]);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const zones = zoneOptions();
  if (!zones.some((z) => z.value === tz)) zones.unshift({ value: tz, label: tz });

  const savePhone = async (e: FormEvent) => {
    e.preventDefault();
    if (savingPhone) return;
    if (phone.replace(/\D/g, "").length !== 10) {
      setPhoneError("Enter a 10-digit mobile number.");
      return;
    }
    setPhoneError(undefined);
    setSavingPhone(true);
    // Your profile's number is copied to your student record on the server.
    await run(() => updateUser(user.id, { phone: phone.trim() }), "Mobile number updated");
    setSavingPhone(false);
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (savingPw) return;
    const errs: typeof pwErrors = {};
    if (!pw.current) errs.current = "Enter your current password.";
    if (pw.next.length < 8) errs.next = "Use at least 8 characters.";
    else if (pw.next === pw.current) errs.next = "Choose a password different from your current one.";
    if (pw.confirm !== pw.next) errs.confirm = "The two passwords don't match.";
    setPwErrors(errs);
    if (errs.current || errs.next || errs.confirm) return;
    setSavingPw(true);
    try {
      await changePassword(user.id, pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      toast({ title: "Password changed", description: "Use your new password next time you sign in.", tone: "success" });
    } catch (err) {
      const message = errorMessage(err);
      setPwErrors(/current password/i.test(message) ? { current: message } : { next: message });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <StudentPage title="Profile">
      <Card>
        <div className="row" style={{ gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
          <Avatar name={user.name} size="lg" />
          <div>
            <div className="t-h3">{user.name}</div>
            <div className="muted">{user.email}</div>
          </div>
        </div>
        <MetaList
          items={[
            { label: "Student since", value: formatDate(student?.createdAt || user.createdAt, tz) },
            ...(student?.city ? [{ label: "City", value: student.city }] : []),
          ]}
        />
      </Card>

      <Card title="Your details" description="To change your name or email, contact your batch coordinator.">
        <form className="stu-inline" onSubmit={(e) => void savePhone(e)} noValidate>
          <TextField label="Mobile number" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneError} />
          <Button type="submit" variant="secondary" touch disabled={savingPhone}>
            {savingPhone ? "Saving…" : "Save number"}
          </Button>
        </form>
      </Card>

      <Card title="Time and appearance">
        <div className="stu-form">
          <SelectField
            label="Time zone"
            value={tz}
            options={zones}
            hint="All class times are shown in this zone"
            onChange={(e) => void run(() => updateUser(user.id, { timeZone: e.target.value }), "Time zone updated", "Class times now show in your new zone.")}
          />
          <div className="stack-1">
            <span className="bl-field-label">Appearance</span>
            <SegmentedControl<ThemeChoice>
              label="Appearance"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "light", label: "Light", icon: "sun" },
                { value: "dark", label: "Dark", icon: "moon" },
                { value: "system", label: "Match system" },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card title="Change password">
        <form className="stu-form" onSubmit={(e) => void savePassword(e)} noValidate>
          <TextField label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwErrors.current} />
          <TextField label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} hint="At least 8 characters" error={pwErrors.next} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErrors.confirm} />
          <div>
            <Button type="submit" touch disabled={savingPw}>
              {savingPw ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="My batches" flush>
        {batches.length ? (
          <ul className="list">
            {batches.map((b) => {
              const att = studentId ? studentAttendance(db, studentId, b.id, now) : undefined;
              const enr = enrolments.find((e) => e.batchId === b.id);
              return (
                <li key={b.id}>
                  <Link to={`/learn/courses/${b.id}`} className="list-link">
                    <span className="stu-rec-text">
                      <span className="list-title">{b.name}</span>
                      <span className="list-sub">
                        {getCourse(db, b.courseId)?.title} · {enr?.status === "completed" ? "Completed" : `Enrolled ${formatDate(enr?.enrolledAt || b.startDate, tz)}`}
                      </span>
                    </span>
                    <span className="caption nowrap">{att && att.held ? `Verified attendance ${att.present} of ${plural(att.held, "lecture")}` : "No lectures yet"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted" style={{ padding: "var(--space-3)" }}>
            You're not enrolled in a batch yet.
          </p>
        )}
      </Card>

      <div>
        <Button
          variant="secondary"
          touch
          icon="logout"
          onClick={() => {
            void logout();
          }}
        >
          Sign out
        </Button>
      </div>
    </StudentPage>
  );
}
