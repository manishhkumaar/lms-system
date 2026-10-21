"use client";
import { Fragment, type ReactNode } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useAlerts } from "@/core/alerts";
import { useTheme } from "@/core/theme";
import { useAuth, useUser } from "@/auth/AuthContext";
import { Button, Menu, Topbar } from "@/design-system";
import { useDocumentTitle } from "@/lib/useNow";
import { useAdminShell } from "./AdminLayout";
import { GlobalSearch } from "./GlobalSearch";

export interface Crumb {
  label: string;
  to?: string;
}

/** "Academics / Batches / FSW-07" with links. */
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="app-crumbs">
      {items.map((c, i) => (
        <Fragment key={i}>
          {i > 0 ? <span aria-hidden="true"> / </span> : null}
          {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}

export interface AdminPageProps {
  /** Page title, also the document title. */
  title: string;
  /** Plain text or <Crumbs>. */
  breadcrumb?: ReactNode;
  /** The page's one primary action (plus at most a secondary one). */
  actions?: ReactNode;
  children: ReactNode;
  /** Hide the global search. */
  search?: boolean;
}

/** Wraps every admin screen: Topbar with search, alerts and the user menu, then the content column. */
export function AdminPage({ title, breadcrumb, actions, children, search = true }: AdminPageProps) {
  useDocumentTitle(title);
  const user = useUser();
  const { logout } = useAuth();
  const shell = useAdminShell();
  const [theme, setTheme] = useTheme();
  const nav = useNavigate();
  const alerts = useAlerts(user.role, user.id);

  const bell = (
    <Menu
      align="end"
      header={alerts.length ? `${alerts.length} ${alerts.length === 1 ? "thing needs" : "things need"} attention` : "Nothing needs attention right now"}
      items={alerts.slice(0, 10).map((a) => ({ label: a.text, icon: a.tone === "danger" ? "video" : a.tone === "warning" ? "alert" : "bell", onClick: () => nav(a.to) }))}
      trigger={(p) => (
        <span className="app-bell">
          <Button variant="ghost" icon="bell" aria-label={`Notifications${alerts.length ? `, ${alerts.length}` : ""}`} {...p} />
          {alerts.length ? <span className="app-bell-dot" aria-hidden="true" /> : null}
        </span>
      )}
    />
  );

  return (
    <>
      <Topbar
        title={title}
        breadcrumb={breadcrumb}
        userName={user.name}
        role={user.role}
        actions={actions}
        search={search}
        searchSlot={<GlobalSearch />}
        onMenu={shell.isMobile ? shell.openDrawer : undefined}
        notifications={bell}
        userMenu={[
          { label: "Light theme", checked: theme === "light", onClick: () => setTheme("light") },
          { label: "Dark theme", checked: theme === "dark", onClick: () => setTheme("dark") },
          { label: "Match system", checked: theme === "system", onClick: () => setTheme("system") },
          "separator",
          {
            label: "Sign out",
            icon: "logout",
            onClick: () => {
              void logout();
            },
          },
        ]}
      />
      <main className="app-content" id="main">
        {children}
      </main>
    </>
  );
}
