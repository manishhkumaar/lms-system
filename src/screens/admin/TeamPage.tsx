"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "@/lib/router";
import { useUser } from "@/auth/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { errorMessage, useRun } from "@/components/useRun";
import { ActionError, inviteUser, revokeInvitation, updateUser } from "@/data/actions";
import { useDb } from "@/data/store";
import type { Role, User } from "@/data/types";
import {
  Banner,
  Button,
  Card,
  CopyField,
  DataTable,
  Dialog,
  EmptyState,
  FilterBar,
  MetaList,
  NameCell,
  NAV,
  ROLE_LABEL,
  SelectField,
  StatusChip,
  TextField,
  useToast,
} from "@/design-system";
import { formatDate, formatRelative, plural } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { AdminPage } from "@/layouts/AdminPage";
import "./overview.css";

type StaffRole = Exclude<Role, "student">;
const STAFF_ROLES: StaffRole[] = ["super-admin", "operations", "course-designer", "admissions"];

/** What each role sees, straight from the Sidebar's navigation table. */
function roleScope(role: StaffRole): string {
  const screens = NAV[role].flatMap((g) => g.items.map((i) => i[1])).join(", ");
  return role === "super-admin" ? `Everything: ${screens}` : screens;
}

const STATUS_CHIP: Record<User["status"], { tone: "success" | "info" | "danger"; label: string }> = {
  active: { tone: "success", label: "Active" },
  invited: { tone: "info", label: "Invite pending" },
  suspended: { tone: "danger", label: "Suspended" },
};

function MemberStatus({ user }: { user: User }) {
  const s = STATUS_CHIP[user.status];
  return (
    <StatusChip status={user.status} tone={s.tone}>
      {s.label}
    </StatusChip>
  );
}

const activationUrl = (u: User) => (u.activationToken ? `${window.location.origin}/activate?token=${u.activationToken}` : "");

export function TeamPage() {
  const me = useUser();
  const db = useDb();
  const now = useNow(60000);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | undefined>();
  const [statusFilter, setStatusFilter] = useState<User["status"] | undefined>();
  const [manageId, setManageId] = useState<string | null>(null);
  const inviting = params.get("invite") === "1";

  const staff = useMemo(() => db.users.filter((u) => u.role !== "student"), [db.users]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return staff
      .filter((u) => (!s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)) && (!roleFilter || u.role === roleFilter) && (!statusFilter || u.status === statusFilter))
      .sort((a, b) => STAFF_ROLES.indexOf(a.role as StaffRole) - STAFF_ROLES.indexOf(b.role as StaffRole) || a.name.localeCompare(b.name));
  }, [staff, q, roleFilter, statusFilter]);

  const setInviting = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set("invite", "1");
    else next.delete("invite");
    setParams(next, { replace: true });
  };

  const managed = manageId ? db.users.find((u) => u.id === manageId) : undefined;
  const filtered = !!(q || roleFilter || statusFilter);

  return (
    <AdminPage
      title="Team & Roles"
      breadcrumb="Admin / Team & Roles"
      actions={
        <Button icon="plus" onClick={() => setInviting(true)}>
          Invite member
        </Button>
      }
    >
      <DataTable<User>
        toolbar={
          <FilterBar
            searchPlaceholder="Search name or email"
            searchValue={q}
            onSearch={setQ}
            filters={[
              { label: "Role", value: roleFilter ? ROLE_LABEL[roleFilter] : undefined, options: STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })), onSelect: (v) => setRoleFilter(v as StaffRole | undefined) },
              {
                label: "Status",
                value: statusFilter ? STATUS_CHIP[statusFilter].label : undefined,
                options: (["active", "invited", "suspended"] as const).map((s) => ({ value: s, label: STATUS_CHIP[s].label })),
                onSelect: (v) => setStatusFilter(v as User["status"] | undefined),
              },
            ]}
          />
        }
        columns={[
          { key: "name", label: "Member", render: (u) => <NameCell name={u.id === me.id ? `${u.name} (you)` : u.name} sub={u.email} /> },
          { key: "role", label: "Role", render: (u) => ROLE_LABEL[u.role] },
          { key: "status", label: "Status", render: (u) => <MemberStatus user={u} /> },
          {
            key: "last",
            label: "Last active",
            render: (u) => (u.status === "invited" ? `Invited ${formatRelative(u.createdAt, now).replace(/^[A-Z]/, (c) => c.toLowerCase())}` : u.lastActiveAt ? formatRelative(u.lastActiveAt, now) : "Never signed in"),
          },
          {
            key: "actions",
            label: <span className="visually-hidden">Actions</span>,
            width: 100,
            render: (u) => (
              <Button
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setManageId(u.id);
                }}
              >
                Manage
              </Button>
            ),
          },
        ]}
        rows={rows}
        onRowClick={(u) => setManageId(u.id)}
        empty={
          filtered ? (
            <EmptyState
              icon="search"
              title="No members match these filters"
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setRoleFilter(undefined);
                    setStatusFilter(undefined);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon="users" title="No team members yet" description="Invite the people who run admissions, courses and batches." />
          )
        }
        footer={
          <span>
            {plural(rows.length, "member")}
            {filtered ? ` of ${staff.length}` : ""} · {plural(staff.filter((u) => u.status === "invited").length, "invite")} pending
          </span>
        }
      />

      <Card title="What each role can see" description="The sidebar shows each role only its screens. Hiding isn't access control: every screen and request also checks the role, and a direct link to a forbidden screen shows Access Denied." flush>
        <ul className="ovw-roles">
          {STAFF_ROLES.map((r) => (
            <li key={r}>
              <span className="list-title">{ROLE_LABEL[r]}</span>
              <span className="muted">{roleScope(r)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
      {managed ? <ManageDialog key={managed.id} user={managed} isSelf={managed.id === me.id} onClose={() => setManageId(null)} /> : null}
    </AdminPage>
  );
}

/* ---------------- Invite member ---------------- */

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("operations");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) reset();
  }, [open]);

  function reset() {
    setName("");
    setEmail("");
    setRole("operations");
    setError(null);
    setDone(null);
  }

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (!name.trim()) throw new ActionError("Enter the person's full name.");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new ActionError("Enter a valid work email address.");
      const res = await inviteUser({ name, email, role });
      setDone({ name: res.user.name, url: window.location.origin + res.activationPath });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Invite ready"
        description={`${done.name} · ${ROLE_LABEL[role]}`}
        footer={
          <>
            <Button variant="secondary" onClick={reset}>
              Invite someone else
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        }
      >
        <Banner tone="success" title="Account invite ready">
          Send {done.name.split(" ")[0]} the activation link below. They set a password there, then see: {roleScope(role)}.
        </Banner>
        <div className="stack-1">
          <span className="bl-field-label">Activation link (works once)</span>
          <CopyField value={done.url} label="activation link" />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite member"
      description="You'll get a link to send them. They set a password there to activate their account."
      width={520}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Inviting…" : "Invite member"}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      <TextField label="Work email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      <SelectField label="Role" required value={role} onChange={(e) => setRole(e.target.value as StaffRole)} options={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} hint={`Sees: ${roleScope(role)}`} />
    </Dialog>
  );
}

/* ---------------- Manage member ---------------- */

function ManageDialog({ user, isSelf, onClose }: { user: User; isSelf: boolean; onClose: () => void }) {
  const db = useDb();
  const run = useRun();
  const toast = useToast();
  const now = useNow(60000);
  const [role, setRole] = useState<StaffRole>(user.role as StaffRole);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [busy, setBusy] = useState(false);
  const changed = role !== user.role;
  const activeAdmins = db.users.filter((u) => u.role === "super-admin" && u.status === "active").length;
  const lastAdmin = user.role === "super-admin" && user.status === "active" && activeAdmins <= 1;

  const saveRole = async () => {
    if (!changed || busy) return;
    setBusy(true);
    try {
      await updateUser(user.id, { role });
      toast({ title: "Role changed", description: `${user.name} is now ${ROLE_LABEL[role]}. Their sidebar updates the next time they load a page.`, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: errorMessage(err), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const suspend = async () => {
    if (lastAdmin) {
      toast({ title: "Keep at least one active Super Admin.", tone: "danger" });
      return;
    }
    setBusy(true);
    const ok = await run(() => updateUser(user.id, { status: "suspended" }), `${user.name} suspended`, "They can't use the app until a Super Admin reactivates them.");
    setBusy(false);
    if (ok) onClose();
  };

  const reactivate = async () => {
    setBusy(true);
    const ok = await run(() => updateUser(user.id, { status: "active" }), `${user.name} reactivated`, "They can sign in again.");
    setBusy(false);
    if (ok) onClose();
  };

  const revoke = async () => {
    setBusy(true);
    const ok = await run(() => revokeInvitation(user.id).then(() => true), "Invite revoked", `${user.name}'s activation link no longer works.`);
    setBusy(false);
    if (ok) onClose();
  };

  const roleHint = isSelf ? "You can't change your own role. Ask another Super Admin." : lastAdmin ? "This is the only active Super Admin, so the role can't change." : changed ? `Will see: ${roleScope(role)}` : "Pick a different role to change it.";

  return (
    <>
      <Dialog
        open={!confirmSuspend}
        onClose={onClose}
        title="Manage member"
        description={`${user.name} · ${user.email}`}
        width={520}
        onSubmit={() => void saveRole()}
        footer={
          <>
            {!isSelf && user.status === "active" ? (
              <Button variant="danger" style={{ marginRight: "auto" }} disabled={busy} onClick={() => setConfirmSuspend(true)}>
                Suspend member
              </Button>
            ) : null}
            {user.status === "invited" ? (
              <Button variant="danger" style={{ marginRight: "auto" }} disabled={busy} onClick={() => void revoke()}>
                Revoke invite
              </Button>
            ) : null}
            {user.status === "suspended" ? (
              <Button variant="secondary" style={{ marginRight: "auto" }} disabled={busy} onClick={() => void reactivate()}>
                Reactivate member
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={!changed || isSelf || lastAdmin || busy}>
              {busy ? "Saving…" : "Change role"}
            </Button>
          </>
        }
      >
        <MetaList
          items={[
            { label: "Status", value: <MemberStatus user={user} /> },
            { label: "Last active", value: user.lastActiveAt ? formatRelative(user.lastActiveAt, now) : "Never signed in" },
            { label: "Added", value: formatDate(user.createdAt) },
            { label: "Phone", value: user.phone || "Not added" },
          ]}
        />
        {user.status === "invited" ? (
          <div className="stack-1">
            <Banner tone="info">Invite pending: {user.name.split(" ")[0]} hasn't set a password yet. Send them this link to activate their account.</Banner>
            {activationUrl(user) ? <CopyField value={activationUrl(user)} label="activation link" /> : null}
          </div>
        ) : null}
        <SelectField
          label="Role"
          value={role}
          disabled={isSelf || lastAdmin}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          options={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          hint={roleHint}
        />
      </Dialog>
      <ConfirmDialog
        open={confirmSuspend}
        title="Suspend member"
        description={`Suspend ${user.name}? They're signed out and can't sign in until a Super Admin reactivates them. Their leads and batches stay as they are.`}
        confirmLabel="Suspend member"
        cancelLabel="Keep access"
        onConfirm={() => void suspend()}
        onClose={() => setConfirmSuspend(false)}
      />
    </>
  );
}
