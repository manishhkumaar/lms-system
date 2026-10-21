import { Fragment } from "react";
import { cx, ROLE_LABEL, type Role } from "../utils";
import { Icon, type IconName } from "./Icon";

export interface NavGroup {
  group: string | null;
  items: Array<[key: string, label: string, icon: IconName]>;
}

export const NAV: Record<Role, NavGroup[]> = {
  "super-admin": [
    { group: "Overview", items: [["dashboard", "Dashboard", "home"], ["reports", "Reports", "chart"]] },
    { group: "Admissions", items: [["leads", "Leads CRM", "inbox"]] },
    { group: "Academics", items: [["courses", "Courses", "book"], ["batches", "Batches", "layers"], ["schedule", "Schedule", "calendar"]] },
    { group: "Delivery", items: [["students", "Students", "users"], ["recordings", "Recordings", "video"], ["attendance", "Attendance", "checklist"]] },
    { group: "Admin", items: [["team", "Team & Roles", "shield"], ["settings", "Settings", "settings"]] },
  ],
  operations: [
    { group: "Overview", items: [["dashboard", "Dashboard", "home"], ["reports", "Reports", "chart"]] },
    { group: "Admissions", items: [["leads", "Leads CRM", "inbox"]] },
    { group: "Delivery", items: [["batches", "Batches", "layers"], ["schedule", "Schedule", "calendar"], ["students", "Students", "users"], ["recordings", "Recordings", "video"], ["attendance", "Attendance", "checklist"]] },
  ],
  "course-designer": [
    { group: "Overview", items: [["dashboard", "Dashboard", "home"]] },
    { group: "Curriculum", items: [["courses", "Courses", "book"], ["materials", "Materials library", "file"]] },
  ],
  admissions: [
    { group: "Overview", items: [["dashboard", "Dashboard", "home"]] },
    { group: "Admissions", items: [["leads", "Leads CRM", "inbox"], ["interviews", "Interviews", "calendar"], ["students", "Enrolments", "graduation"]] },
  ],
  student: [
    { group: null, items: [["dashboard", "Home", "home"], ["courses", "My courses", "book"], ["timeline", "Lecture timeline", "calendar"], ["recordings", "Recordings", "video"], ["materials", "Materials", "file"], ["profile", "Profile", "user"]] },
  ],
};

export interface SidebarProps {
  role?: Role;
  /** The current item key. */
  active?: string;
  collapsed?: boolean;
  /** Shows the collapse button when given. */
  onToggle?: () => void;
  onNavigate?: (key: string) => void;
  badges?: Record<string, number | string>;
  brand?: string;
  mark?: string;
  nav?: NavGroup[];
  className?: string;
}

/** The slate, collapsible left navigation. Items come from the signed-in user's role. */
export function Sidebar({ role = "super-admin", active, collapsed, onToggle, onNavigate, badges = {}, brand, mark, nav, className }: SidebarProps) {
  const groups = nav || NAV[role];
  return (
    <nav className={cx("bl-sidebar", collapsed && "collapsed", className)} aria-label="Main">
      <div className="bl-sidebar-brand">
        <span className="bl-sidebar-mark" aria-hidden="true">
          {mark || "B"}
        </span>
        <span className="bl-sidebar-name">{brand || "Batch LMS"}</span>
      </div>
      {groups.map((g, gi) => (
        <Fragment key={gi}>
          {g.group ? <div className="bl-sidebar-group">{g.group}</div> : null}
          {g.items.map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              className="bl-nav-item"
              aria-current={active === key ? "page" : undefined}
              title={collapsed ? label : undefined}
              onClick={() => onNavigate?.(key)}
            >
              <Icon name={icon} />
              <span className="bl-nav-label">{label}</span>
              {badges[key] ? <span className="bl-nav-badge">{badges[key]}</span> : null}
            </button>
          ))}
        </Fragment>
      ))}
      {onToggle ? (
        <div className="bl-sidebar-foot">
          <button type="button" className="bl-nav-item" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} />
            <span className="bl-nav-label">Collapse</span>
          </button>
        </div>
      ) : null}
    </nav>
  );
}

Sidebar.nav = NAV;
Sidebar.roles = ROLE_LABEL;
