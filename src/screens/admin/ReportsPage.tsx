"use client";
import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useUser } from "@/auth/AuthContext";
import {
  activeStudentCount,
  attendanceByBatch,
  batchSummary,
  enrolmentSeries,
  feesCollected,
  leadConversion,
  leadsBySource,
  leadsCreated,
  newEnrolments,
  PERIOD_LABEL,
  periodStart,
  pipelineByStage,
  type BatchSummaryRow,
  type Period,
} from "@/data/overviewSelectors";
import { verifiedAttendanceRate } from "@/data/selectors";
import { useDb } from "@/data/store";
import { Button, DataTable, NameCell, SegmentedControl, StatGrid, StatusChip, statusLabel, useToast } from "@/design-system";
import { formatINR, formatNumber, plural } from "@/lib/format";
import { dateKey, DEFAULT_TZ } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { AdminPage } from "@/layouts/AdminPage";
import { BarList, ChartCard, ColumnChart } from "./overview/Charts";
import { Stat } from "./overview/parts";
import "./overview.css";

const pct = (n: number) => `${Math.round(n)}%`;

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(name: string, header: string[], rows: Array<Array<string | number>>) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportsPage() {
  const user = useUser();
  const db = useDb();
  const now = useNow(60000);
  const nav = useNavigate();
  const toast = useToast();
  const tz = user.timeZone || DEFAULT_TZ;
  const [period, setPeriod] = useState<Period>("30d");
  const label = PERIOD_LABEL[period];

  const d = useMemo(() => {
    const from = periodStart(period, now, tz);
    const joins = newEnrolments(db, from, now).length;
    const created = leadsCreated(db, from, now);
    return {
      active: activeStudentCount(db),
      joins,
      conversion: leadConversion(db, from, now),
      attendance: verifiedAttendanceRate(db, now, { sinceMs: from }),
      fees: feesCollected(db, from, now),
      series: enrolmentSeries(db, period, now, tz),
      sources: leadsBySource(db, from, now),
      leadsTotal: created.length,
      pipeline: pipelineByStage(created),
      byBatch: attendanceByBatch(db, now, from),
      summary: batchSummary(db, now),
    };
  }, [db, now, period, tz]);

  const exportCsv = () => {
    downloadCsv(
      `batch-summary-${dateKey(new Date(now), tz)}.csv`,
      ["Batch code", "Batch", "Course", "Status", "Seats filled", "Capacity", "Lectures held", "Lectures planned", "Verified attendance %", "Recordings published"],
      d.summary.map((r) => [r.batch.code, r.batch.name, r.course, statusLabel(r.state), r.filled, r.capacity, r.held, r.planned, r.hasAttendance ? Math.round(r.attendancePct) : "", r.recordingsPublished]),
    );
    toast({ title: "Batch summary exported", description: `${plural(d.summary.length, "batch", "batches")} as CSV`, tone: "success" });
  };

  const enrolUnit = (n: number) => plural(n, "enrolment");
  const seriesEmpty = d.series.every((p) => p.value === 0);

  return (
    <AdminPage
      title="Reports"
      breadcrumb="Overview / Reports"
      actions={
        <Button variant="secondary" icon="download" onClick={exportCsv}>
          Export CSV
        </Button>
      }
    >
      <div className="ovw-period">
        <span className="t-label muted">Period</span>
        <SegmentedControl
          label="Report period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "30d", label: "30 days" },
            { value: "90d", label: "90 days" },
            { value: "year", label: "This year" },
          ]}
        />
        <span className="caption">Everything below covers {label.toLowerCase()}, except seats and active students, which are as of now.</span>
      </div>

      <StatGrid>
        <Stat title="Active students" value={formatNumber(d.active)} delta={`+${formatNumber(d.joins)} enrolled · ${label.toLowerCase()}`} tone={d.joins ? "up" : undefined} />
        <Stat title="Lead → enrolment" value={d.conversion.created ? `${d.conversion.pct.toFixed(1)}%` : "—"} delta={`${formatNumber(d.conversion.enrolled)} of ${plural(d.conversion.created, "lead")} · ${label.toLowerCase()}`} />
        <Stat
          title="Verified attendance"
          value={d.attendance.expected ? pct(d.attendance.pct) : "—"}
          delta={d.attendance.expected ? `${formatNumber(d.attendance.present)} present of ${formatNumber(d.attendance.expected)} · ${label.toLowerCase()}` : `No lectures held · ${label.toLowerCase()}`}
        />
        <Stat title="Fees collected" value={formatINR(d.fees)} delta={`From ${plural(d.joins, "enrolment")} · ${label.toLowerCase()}`} />
      </StatGrid>

      <div className="grid-2">
        <ChartCard
          title="Enrolments"
          description={period === "year" ? "New enrolments per month, this year. Transfers aren't counted." : `New enrolments per week, ${label.toLowerCase()}. Transfers aren't counted.`}
          table={{ columns: [period === "year" ? "Month" : "Week", "Enrolments"], rows: d.series.map((p) => [p.long, formatNumber(p.value)]), numeric: [1] }}
          empty={seriesEmpty ? <p className="muted">No enrolments in this period.</p> : undefined}
        >
          <ColumnChart points={d.series} unit={enrolUnit} label={`Enrolments per ${period === "year" ? "month" : "week"}`} />
        </ChartCard>

        <ChartCard
          title="Leads by source"
          description={`Where the ${plural(d.leadsTotal, "lead")} created in this period came from`}
          table={{ columns: ["Source", "Leads", "Share"], rows: d.sources.map((s) => [s.source, formatNumber(s.count), d.leadsTotal ? pct((s.count / d.leadsTotal) * 100) : "—"]), numeric: [1, 2] }}
          empty={d.leadsTotal ? undefined : <p className="muted">No leads were created in this period.</p>}
        >
          <BarList
            label="Leads by source"
            rows={d.sources.map((s) => ({
              key: s.source,
              label: s.source,
              text: s.source,
              value: s.count,
              display: formatNumber(s.count),
              detail: `${d.leadsTotal ? pct((s.count / d.leadsTotal) * 100) : "0%"} of ${plural(d.leadsTotal, "lead")}`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Pipeline by stage"
          description="Leads created in this period, by the stage they're at now"
          table={{ columns: ["Stage", "Leads"], rows: d.pipeline.map((p) => [statusLabel(p.stage), formatNumber(p.count)]), numeric: [1] }}
          empty={d.leadsTotal ? undefined : <p className="muted">No leads were created in this period.</p>}
        >
          <BarList
            label="Leads by stage"
            rows={d.pipeline.map((p) => ({
              key: p.stage,
              label: <StatusChip status={p.stage} />,
              text: statusLabel(p.stage),
              value: p.count,
              display: formatNumber(p.count),
              detail: `${d.leadsTotal ? pct((p.count / d.leadsTotal) * 100) : "0%"} of leads created`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Verified attendance by batch"
          description="Present, as verified by the meeting provider or Operations, of students expected. Join clicks don't count."
          table={{
            columns: ["Batch", "Verified attendance", "Present", "Expected"],
            rows: d.byBatch.map((r) => [`${r.batch.code} · ${r.batch.name}`, pct(r.pct), formatNumber(r.present), formatNumber(r.expected)]),
            numeric: [1, 2, 3],
          }}
          empty={d.byBatch.length ? undefined : <p className="muted">No lectures were held in this period.</p>}
        >
          <BarList
            label="Verified attendance by batch"
            max={100}
            rows={d.byBatch.map((r) => ({
              key: r.batch.id,
              label: <span className="bl-mono">{r.batch.code}</span>,
              text: r.batch.name,
              value: r.pct,
              display: pct(r.pct),
              detail: `${formatNumber(r.present)} present of ${formatNumber(r.expected)} expected`,
            }))}
          />
        </ChartCard>
      </div>

      <DataTable<BatchSummaryRow>
        toolbar={
          <div className="bl-card-head">
            <div style={{ flex: 1 }}>
              <h3 className="bl-card-title">Batch summary</h3>
              <p className="bl-card-desc">Every batch to date. Seats are as of now; attendance and recordings cover lectures held so far.</p>
            </div>
          </div>
        }
        columns={[
          { key: "batch", label: "Batch", render: (r) => <NameCell name={r.batch.name} sub={<span className="bl-mono">{r.batch.code}</span>} /> },
          { key: "course", label: "Course" },
          { key: "state", label: "Status", render: (r) => <StatusChip status={r.state} /> },
          { key: "seats", label: "Seats", numeric: true, render: (r) => `${r.filled} of ${r.capacity}` },
          { key: "held", label: "Lectures held", numeric: true, render: (r) => `${r.held} of ${r.planned}` },
          { key: "att", label: "Verified attendance", numeric: true, render: (r) => (r.hasAttendance ? pct(r.attendancePct) : "—") },
          { key: "rec", label: "Recordings published", numeric: true, render: (r) => (r.held ? `${r.recordingsPublished} of ${r.held}` : "—") },
        ]}
        rows={d.summary}
        onRowClick={(r) => nav(`/admin/batches/${r.batch.id}`)}
        footer={<span>{plural(d.summary.length, "batch", "batches")}</span>}
      />
    </AdminPage>
  );
}
