"use client";
import { Suspense, useMemo, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { activeNavKey, navPath } from "@/core/access";
import { useTheme } from "@/core/theme";
import { useAuth, useUser } from "@/auth/AuthContext";
import { useDb } from "@/data/store";
import { studentHasMaterials } from "@/data/selectors";
import { Avatar, BottomNav, Icon, Menu, NAV, Sidebar, type NavGroup } from "@/design-system";
import { useIsMobile } from "@/lib/useMediaQuery";
import { useDocumentTitle } from "@/lib/useNow";

/** Student portal: mobile-first. Bottom tab bar under 768px, Sidebar above. */
export function StudentLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  const db = useDb();
  const nav = useNavigate();
  const loc = useLocation();
  const isMobile = useIsMobile();
  const hasMaterials = useMemo(() => (user.studentId ? studentHasMaterials(db, user.studentId) : false), [db, user.studentId]);

  // Materials are optional per course: when no course has them on, hide the tab entirely.
  const navGroups = useMemo<NavGroup[]>(() => NAV.student.map((g) => ({ ...g, items: g.items.filter(([k]) => hasMaterials || k !== "materials") })), [hasMaterials]);
  const active = activeNavKey("student", loc.pathname);

  return (
    <div className="app-student">
      {!isMobile ? (
        <div className="app-admin-side">
          <Sidebar role="student" nav={navGroups} active={active} brand={db.settings.orgName} onNavigate={(k) => nav(navPath("student", k))} />
        </div>
      ) : null}
      <div className="app-student-main">
        <Suspense fallback={<div className="app-loading" aria-busy="true" />}>
          {children}
        </Suspense>
      </div>
      {isMobile ? (
        <BottomNav
          active={active}
          onNavigate={(k) => nav(navPath("student", k))}
          items={[
            { key: "dashboard", label: "Home", icon: "home" },
            { key: "courses", label: "Courses", icon: "book" },
            { key: "timeline", label: "Timeline", icon: "calendar" },
            { key: "recordings", label: "Recordings", icon: "video" },
            { key: "profile", label: "Profile", icon: "user" },
          ]}
        />
      ) : null}
    </div>
  );
}

export interface StudentPageProps {
  title: string;
  /** Hide the visible h1 (e.g. the dashboard uses a display greeting instead). */
  hideTitle?: boolean;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
  children: ReactNode;
}

/** Wraps every student screen: a calm single column with the page title. */
export function StudentPage({ title, hideTitle, subtitle, back, actions, children }: StudentPageProps) {
  useDocumentTitle(title);
  const user = useUser();
  const { logout } = useAuth();
  const [theme, setTheme] = useTheme();
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const db = useDb();

  const userMenu = (
    <Menu
      align="end"
      header={user.email}
      items={[
        { label: "Profile", icon: "user", onClick: () => nav("/learn/profile") },
        "separator",
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
      trigger={(p) => (
        <button type="button" className="bl-topbar-userbtn" aria-label={`${user.name}, account menu`} {...p}>
          <Avatar name={user.name} />
        </button>
      )}
    />
  );

  return (
    <>
      {isMobile ? (
        <header className="app-student-top">
          <span className="bl-sidebar-mark" aria-hidden="true">
            B
          </span>
          <span className="app-student-brand">{db.settings.orgName}</span>
          <span style={{ marginLeft: "auto" }}>{userMenu}</span>
        </header>
      ) : null}
      <main className="app-student-content" id="main">
        <div className="app-student-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            {back ? (
              <Link to={back.to} className="app-back">
                <Icon name="chevronLeft" />
                {back.label}
              </Link>
            ) : null}
            <h1 className={hideTitle ? "visually-hidden" : "t-h1"} style={{ margin: 0 }}>
              {title}
            </h1>
            {subtitle ? <div className="app-student-sub">{subtitle}</div> : null}
          </div>
          {actions ? <div className="bl-row">{actions}</div> : null}
          {!isMobile ? userMenu : null}
        </div>
        {children}
      </main>
    </>
  );
}
