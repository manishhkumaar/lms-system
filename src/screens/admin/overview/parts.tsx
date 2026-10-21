import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import type { Alert } from "@/core/alerts";
import { cx, Icon, type IconName } from "@/design-system";

/**
 * A StatCard that can also show its delta in warning (e.g. overdue follow-ups).
 * Same classes as StatCard; StatCard itself only colours up/down trends.
 */
export function Stat({ title, value, delta, tone }: { title: string; value: string; delta?: string; tone?: "up" | "down" | "warning" }) {
  return (
    <div className="bl-card bl-stat">
      <span className="bl-stat-title">{title}</span>
      <span className="bl-stat-value">{value}</span>
      {delta ? <span className={cx("bl-stat-delta", tone === "warning" ? "text-warning" : tone)}>{delta}</span> : null}
    </div>
  );
}

const ALERT_ICON: Record<Alert["tone"], IconName> = { danger: "video", warning: "alert", info: "bell", neutral: "checklist", success: "check" };

/** The "Needs attention" list: one row per alert, each a link to where it gets fixed. */
export function AlertList({ alerts, empty = "Nothing needs attention right now." }: { alerts: Alert[]; empty?: string }) {
  if (!alerts.length) return <p className="ovw-empty">{empty}</p>;
  return (
    <ul className="list">
      {alerts.map((a) => (
        <li key={a.id}>
          <Link to={a.to} className="list-link">
            <Icon name={ALERT_ICON[a.tone]} className={cx("ovw-alert-icon", a.tone)} />
            <span className="ovw-grow list-title" style={{ fontWeight: 400 }}>
              {a.text}
            </span>
            <Icon name="chevronRight" className="ovw-alert-icon" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A row in a card list that links somewhere. */
export function LinkRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="list-link">
        {children}
      </Link>
    </li>
  );
}
