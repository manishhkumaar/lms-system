"use client";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/components/useRun";
import { resetPassword } from "@/data/actions";
import { Banner, Button, TextField } from "@/design-system";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Link } from "@/lib/router";

/** Reached from the emailed reset link, which signs the person in for this one change. */
export function ResetPasswordPage({ hasSession }: { hasSession: boolean }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string; form?: string }>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <AuthLayout title="Password updated" description="You're signed in with your new password.">
        <a href="/" className="bl-btn bl-btn-primary bl-btn-touch bl-btn-block" style={{ textDecoration: "none" }}>
          Go to your dashboard
        </a>
      </AuthLayout>
    );
  }

  if (!hasSession) {
    return (
      <AuthLayout title="This link has expired" description="Reset links work once and expire after an hour.">
        <Link to="/forgot-password" className="bl-btn bl-btn-primary bl-btn-touch bl-btn-block" style={{ textDecoration: "none" }}>
          Request a new link
        </Link>
        <Link to="/login">Back to sign in</Link>
      </AuthLayout>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (pw.length < 8) next.pw = "Use at least 8 characters.";
    if (confirm !== pw) next.confirm = "The two passwords don't match.";
    setErrors(next);
    if (next.pw || next.confirm) return;
    setBusy(true);
    try {
      await resetPassword(pw);
      setDone(true);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Set a new password" description="Choose a password you don't use anywhere else.">
      {errors.form ? <Banner tone="danger">{errors.form}</Banner> : null}
      <form className="stack" onSubmit={submit} noValidate>
        <TextField label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters" error={errors.pw} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <Button type="submit" block touch disabled={busy}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
