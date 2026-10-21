import type { ReactNode } from "react";
import { ROLE_LABEL, initials, type Role } from "../utils";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Menu, type MenuItem } from "./Menu";

export interface TopbarProps {
  title: string;
  breadcrumb?: ReactNode;
  userName: string;
  role: Role;
  /** Usually one primary Button: exactly one primary action per page. */
  actions?: ReactNode;
  search?: boolean;
  searchPlaceholder?: string;
  /** Replaces the default search input (for a global search with results). */
  searchSlot?: ReactNode;
  /** Shows the menu button that opens the mobile drawer. */
  onMenu?: () => void;
  /** Items in the menu under the signed-in user. */
  userMenu?: MenuItem[];
  notifications?: ReactNode;
}

/** The 64px bar above every admin page. */
export function Topbar({ title, breadcrumb, userName, role, actions, search, searchPlaceholder, searchSlot, onMenu, userMenu, notifications }: TopbarProps) {
  const user = (
    <div className="bl-topbar-user">
      <span className="bl-avatar">{initials(userName)}</span>
      <div className="bl-topbar-user-text">
        <div style={{ font: "500 13px/18px var(--font-sans)", color: "var(--ink)" }}>{userName}</div>
        <div className="bl-role">{ROLE_LABEL[role] || role}</div>
      </div>
    </div>
  );
  return (
    <header className="bl-topbar">
      {onMenu ? <Button variant="ghost" icon="menu" aria-label="Open menu" onClick={onMenu} className="bl-topbar-menu" /> : null}
      <div className="bl-topbar-heading">
        {breadcrumb ? <div className="bl-topbar-crumb">{breadcrumb}</div> : null}
        <h1 className="bl-topbar-title">{title}</h1>
      </div>
      {search === false ? (
        <div style={{ marginLeft: "auto" }} />
      ) : (
        searchSlot || (
          <div className="bl-search">
            <Icon name="search" />
            <input className="bl-input" placeholder={searchPlaceholder || "Search students, batches, leads…"} aria-label="Search" />
          </div>
        )
      )}
      {actions ? <div className="bl-topbar-actions">{actions}</div> : null}
      {notifications ?? <Button variant="ghost" icon="bell" aria-label="Notifications" />}
      {userMenu && userMenu.length ? (
        <Menu align="end" items={userMenu} trigger={(p) => <button type="button" className="bl-topbar-userbtn" aria-label={`${userName}, account menu`} {...p}>{user}</button>} />
      ) : (
        user
      )}
    </header>
  );
}
