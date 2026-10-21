import type { ReactNode } from "react";
import { cx } from "../utils";

export interface Column<R> {
  key: string;
  label: ReactNode;
  render?: (row: R) => ReactNode;
  numeric?: boolean;
  width?: number | string;
}

export interface DataTableProps<R extends { id: string | number }> {
  columns: Column<R>[];
  rows: R[];
  /** Usually a FilterBar. */
  toolbar?: ReactNode;
  /** Count and pagination. */
  footer?: ReactNode;
  onRowClick?: (row: R) => void;
  selectedId?: string | number;
  /** An EmptyState shown when there are no rows. */
  empty?: ReactNode;
  className?: string;
}

/** The list view for students, batches, leads, lectures, recordings and attendance. */
export function DataTable<R extends { id: string | number }>({ columns, rows, toolbar, footer, onRowClick, selectedId, empty, className }: DataTableProps<R>) {
  return (
    <div className={cx("bl-card", className)}>
      {toolbar || null}
      <div className="bl-table-wrap">
        <table className="bl-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.numeric ? "num" : undefined} style={c.width ? { width: c.width } : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                aria-selected={selectedId != null && selectedId === r.id ? "true" : undefined}
                className={cx(onRowClick && "clickable")}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(r);
                      }
                    : undefined
                }
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.numeric ? "num" : undefined}>
                    {c.render ? c.render(r) : ((r as Record<string, unknown>)[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && empty ? empty : null}
      {footer ? <div className="bl-table-foot">{footer}</div> : null}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="bl-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** A name cell with a secondary line underneath. */
export function NameCell({ name, sub }: { name: ReactNode; sub?: ReactNode }) {
  return (
    <span>
      {name}
      {sub ? <span className="bl-cell-sub">{sub}</span> : null}
    </span>
  );
}
