"use client";
import { ACCESS, homePath, SCREEN_LABEL, type AdminKey } from "@/core/access";
import { useAuth } from "@/auth/AuthContext";
import { Button, ROLE_LABEL, type Role } from "@/design-system";
import { AuthLayout } from "@/layouts/AuthLayout";

function listRoles(roles: Role[]) {
  const names = roles.map((r) => ROLE_LABEL[r]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface AccessDeniedProps {
  /** The signed-in person, if any. */
  person: { name: string; role: Role } | null;
  screen?: string;
  from?: string;
  allowed?: Role[];
  reason?: "no-profile" | "suspended";
}

/** A forbidden URL lands here, naming the person's role and offering the way back. */
export function AccessDeniedPage({ person, screen, from, allowed, reason }: AccessDeniedProps) {
  const { logout } = useAuth();
  const signOut = (
    <Button variant="secondary" touch block onClick={() => logout()}>
      Sign in as someone else
    </Button>
  );

  if (reason === "suspended" || reason === "no-profile" || !person) {
    return (
      <AuthLayout
        title={reason === "suspended" ? "This account is suspended" : "Your account isn't set up yet"}
        description={reason === "suspended" ? "Contact your administrator to restore access." : "You're signed in, but no role has been given to this account. Ask your administrator to invite you."}
      >
        {signOut}
      </AuthLayout>
    );
  }

  const key = screen && screen in SCREEN_LABEL ? (screen as AdminKey) : undefined;
  const label = key ? SCREEN_LABEL[key] : undefined;
  const roles = key ? ACCESS[key] : allowed;
  const what = label || (from?.startsWith("/learn") ? "the student portal" : from?.startsWith("/admin") ? "the admin portal" : "this page");

  return (
    <AuthLayout
      title={`You don't have access to ${what}`}
      description={`You're signed in as ${person.name} (${ROLE_LABEL[person.role]}).${roles?.length ? ` ${what[0].toUpperCase() + what.slice(1)} is available to ${listRoles(roles)}.` : ""}`}
    >
      {from ? (
        <p className="caption">
          Requested: <span className="bl-mono">{from}</span>
        </p>
      ) : null}
      <a href={homePath(person.role)} className="bl-btn bl-btn-primary bl-btn-touch bl-btn-block" style={{ textDecoration: "none" }}>
        Go to your dashboard
      </a>
      {signOut}
      <p className="caption">If you need this access for your work, ask a Super Admin to change your role in Team &amp; Roles.</p>
    </AuthLayout>
  );
}
