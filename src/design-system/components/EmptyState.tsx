import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: IconName;
  /** One Button: the action that fills it. */
  action?: ReactNode;
}

/** What a table, board or library shows when it has nothing in it yet. */
export function EmptyState({ title, description, icon = "inbox", action }: EmptyStateProps) {
  return (
    <div className="bl-empty">
      <span className="bl-empty-icon">
        <Icon name={icon} size="lg" />
      </span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action || null}
    </div>
  );
}
