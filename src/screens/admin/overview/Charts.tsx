/*
 * Small single-series charts for Reports and dashboards, following the dataviz rules:
 * thin bars from one baseline with a 4px rounded data-end, values in text tokens (never the
 * bar colour), selective labels, a tooltip on hover and keyboard focus, and a table view.
 */
import { useState, type ReactNode } from "react";
import { Button, Card } from "@/design-system";

/* ---------- Card with a chart / table switch ---------- */
export interface ChartTable {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  /** Columns (by index) that hold numbers: right-aligned, mono. */
  numeric?: number[];
}

export function ChartCard({ title, description, table, children, empty }: { title: string; description: string; table: ChartTable; children: ReactNode; empty?: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card
      title={title}
      description={description}
      actions={
        empty ? null : (
          <Button variant="ghost" icon={asTable ? "chart" : "list"} onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? "View as chart" : "View as table"}
          </Button>
        )
      }
    >
      {empty ? (
        empty
      ) : asTable ? (
        <div className="bl-table-wrap ovw-table">
          <table className="bl-table">
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={table.numeric?.includes(i) ? "num" : undefined}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className={table.numeric?.includes(j) ? "num" : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

/* ---------- Horizontal bar list ---------- */
export interface BarRow {
  key: string;
  /** Category label (text or a StatusChip). */
  label: ReactNode;
  /** Plain-text label for tooltips and screen readers. */
  text: string;
  value: number;
  /** What's printed at the bar tip, e.g. "86%" or "12". */
  display: string;
  /** Extra line in the tooltip, e.g. "412 present of 480 expected". */
  detail?: string;
}

export function BarList({ rows, max, label }: { rows: BarRow[]; max?: number; label: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="ovw-bars" aria-label={label}>
      {rows.map((r) => {
        const pct = top ? Math.max(0, Math.min(100, (r.value / top) * 100)) : 0;
        const on = hover === r.key;
        return (
          <li
            key={r.key}
            className="ovw-bar-row"
            tabIndex={0}
            aria-label={`${r.text}: ${r.display}${r.detail ? `, ${r.detail}` : ""}`}
            onPointerEnter={() => setHover(r.key)}
            onPointerLeave={() => setHover((h) => (h === r.key ? null : h))}
            onFocus={() => setHover(r.key)}
            onBlur={() => setHover((h) => (h === r.key ? null : h))}
          >
            <span className="ovw-bar-label">{r.label}</span>
            <span className="ovw-bar-track" aria-hidden="true">
              {r.value > 0 ? <span className={`ovw-bar${on ? " on" : ""}`} style={{ width: `${pct}%` }} /> : null}
              <span className="ovw-bar-value" style={{ left: `${pct}%` }}>
                {r.display}
              </span>
            </span>
            {on && r.detail ? (
              <span className="ovw-tip" role="tooltip">
                <strong>{r.display}</strong>
                <span>{r.text}</span>
                <span>{r.detail}</span>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Columns over time ---------- */
export interface ColumnPoint {
  key: string;
  label: string;
  long: string;
  value: number;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Vertical columns from one baseline. Labels the peak and the latest value; the rest live in the tooltip and table. */
export function ColumnChart({ points, unit, label, height = 180 }: { points: ColumnPoint[]; unit: (n: number) => string; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(0, ...points.map((p) => p.value));
  const top = niceMax(peak);
  const ticks = [0, top / 2, top];
  const peakIdx = points.findIndex((p) => p.value === peak);
  const lastIdx = points.length - 1;
  // Thin out x labels so they never collide.
  const every = points.length > 8 ? Math.ceil(points.length / 7) : 1;
  return (
    <div className="ovw-cols" role="group" aria-label={label}>
      <div className="ovw-cols-y" style={{ height }} aria-hidden="true">
        {ticks
          .slice()
          .reverse()
          .map((t) => (
            <span key={t}>{Number.isInteger(t) ? t : t.toFixed(1)}</span>
          ))}
      </div>
      <div className="ovw-cols-main">
        <div className="ovw-cols-plot" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="ovw-grid" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden="true" />
          ))}
          {points.map((p, i) => {
            const h = top ? (p.value / top) * 100 : 0;
            const showLabel = p.value > 0 && (i === peakIdx || i === lastIdx);
            return (
              <div
                key={p.key}
                className="ovw-col-slot"
                tabIndex={0}
                aria-label={`${p.long}: ${unit(p.value)}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover((x) => (x === i ? null : x))}
                onFocus={() => setHover(i)}
                onBlur={() => setHover((x) => (x === i ? null : x))}
              >
                {p.value > 0 ? <span className={`ovw-col${hover === i ? " on" : ""}`} style={{ height: `${h}%` }} /> : null}
                {showLabel ? (
                  <span className="ovw-col-value" style={{ bottom: `${h}%` }} aria-hidden="true">
                    {p.value}
                  </span>
                ) : null}
                {hover === i ? (
                  <span className={`ovw-tip ovw-tip-col${i > points.length / 2 ? " left" : ""}`} role="tooltip">
                    <strong>{unit(p.value)}</strong>
                    <span>{p.long}</span>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="ovw-cols-x" aria-hidden="true">
          {points.map((p, i) => (
            <span key={p.key}>{i % every === 0 || i === lastIdx ? p.label : ""}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
