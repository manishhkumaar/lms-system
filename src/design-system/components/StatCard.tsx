import type { ReactNode } from "react";
import { cx } from "../utils";

export interface StatCardProps {
  /** Short; uppercase is applied. */
  title: string;
  /** Pre-formatted with Indian digit grouping: 1,28,400. */
  value: string;
  /** Always says what it's compared with ("vs Sept", "Last 30 days"). */
  delta?: string;
  trend?: "up" | "down";
}

export function StatCard({ title, value, delta, trend }: StatCardProps) {
  return (
    <div className="bl-card bl-stat">
      <span className="bl-stat-title">{title}</span>
      <span className="bl-stat-value">{value}</span>
      {delta ? <span className={cx("bl-stat-delta", trend)}>{delta}</span> : null}
    </div>
  );
}

/** Four per row on desktop, two on tablet, one on mobile. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="bl-stat-grid">{children}</div>;
}
