"use client";
import { useState, type FormEvent } from "react";
import { homePath } from "@/core/access";
import { useAuth } from "@/auth/AuthContext";
import { errorMessage } from "@/components/useRun";
import { activateAccount } from "@/data/actions";
import { Banner, Button, MetaList, ROLE_LABEL, TextField, type Role } from "@/design-system";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Link, useNavigate } from "@/lib/router";

export interface InvitationInfo {
  name: string;
  email: string;
  role: Role;
}

/** First-time account activation from an invite link. The server looked the invite up by token. */
export function ActivatePage({ token, invitation }: { token: string; invitation: InvitationInfo | null }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  if (!invitation) {
    return (
      <AuthLayout title="This activation link has expired" description="Activation links work once. If you've already set a password, sign in. Otherwise ask your administrator to send a new invite.">
        <Link to="/login" className="bl-btn bl-btn-primary bl-btn-touch bl-btn-block" style={{ textDecoration: "none" }}>
          Go to sign in
        </Link>
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
      const { email } = await activateAccount(token, pw);
      const res = await login(email, pw);
      nav(res.ok ? homePath(res.user.role) : "/login", { replace: true });
    } catch (err) {
      setErrors({ form: errorMessage(err) });
      setBusy(false);
    }
  };

  const isStudent = invitation.role === "student";
  return (
    <AuthLayout
      title={`Welcome, ${invitation.name.split(" ")[0]}!`}
      description={isStudent ? "Set a password to activate your account. You'll see your batch, live classes and recordings straight after." : "Set a password to activate your staff account."}
    >
      {errors.form ? <Banner tone="danger">{errors.form}</Banner> : null}
      <MetaList
        items={[
          { label: "Email", value: invitation.email },
          { label: "Role", value: ROLE_LABEL[invitation.role] },
        ]}
      />
      <form className="stack" onSubmit={submit} noValidate>
        <TextField label="Password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters" error={errors.pw} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <Button type="submit" block touch disabled={busy}>
          {busy ? "Activating…" : "Activate account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
