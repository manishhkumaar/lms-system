"use client";
import { useState, type FormEvent } from "react";
import { homePath } from "@/core/access";
import { useAuth } from "@/auth/AuthContext";
import { Banner, Button, ROLE_LABEL, TextField, type Role } from "@/design-system";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Link, useNavigate, useSearchParams } from "@/lib/router";

/** Seeded demo accounts (npm run db:seed). Shown only when NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true. */
const DEMO: Array<{ email: string; role: Role }> = [
  { email: "kavya@example.in", role: "super-admin" },
  { email: "anjali@example.in", role: "operations" },
  { email: "lakshmi@example.in", role: "course-designer" },
  { email: "meera@example.in", role: "admissions" },
  { email: "priya@example.in", role: "student" },
];
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const from = params.get("from");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") === "link-expired" ? "That link has expired. Sign in, or request a new link." : null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const safeFrom = from && from.startsWith("/") && !from.startsWith("//") ? from : null;
    const target = safeFrom && (res.user.role === "student") === safeFrom.startsWith("/learn") ? safeFrom : homePath(res.user.role);
    nav(target, { replace: true });
  };

  return (
    <AuthLayout
      title="Sign in"
      description="One sign-in for students and staff. You'll land on the dashboard for your role."
      footer={
        SHOW_DEMO ? (
          <div className="stack-1" style={{ alignItems: "center" }}>
            <span>Demo accounts (password demo1234)</span>
            <div className="row" style={{ justifyContent: "center" }}>
              {DEMO.map((u) => (
                <Button
                  key={u.email}
                  variant="secondary"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword("demo1234");
                    setError(null);
                  }}
                >
                  {ROLE_LABEL[u.role]}
                </Button>
              ))}
            </div>
          </div>
        ) : undefined
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <form className="stack" onSubmit={submit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.in" />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="row-between">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button type="submit" block touch disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
