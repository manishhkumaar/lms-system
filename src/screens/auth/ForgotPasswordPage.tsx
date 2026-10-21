"use client";
import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "@/data/actions";
import { Banner, Button, TextField } from "@/design-system";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Link } from "@/lib/router";

const LOCAL = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "");

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email address you sign in with.");
      return;
    }
    setError(null);
    setBusy(true);
    await requestPasswordReset(email).catch(() => undefined);
    setBusy(false);
    setSent(email.trim());
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" description={`If an account exists for ${sent}, we've sent a link to reset your password.`}>
        {LOCAL ? (
          <Banner tone="info" title="Local development">
            Emails are caught by Mailpit. Open <a href="http://127.0.0.1:54324" target="_blank" rel="noopener noreferrer">127.0.0.1:54324</a> to find the link.
          </Banner>
        ) : null}
        <Link to="/login">Back to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" description="Enter your email and we'll send you a link to set a new password.">
      <form className="stack" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error || undefined} />
        <Button type="submit" block touch disabled={busy}>
          Send reset link
        </Button>
      </form>
      <Link to="/login">Back to sign in</Link>
    </AuthLayout>
  );
}
