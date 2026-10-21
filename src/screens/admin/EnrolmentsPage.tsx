"use client";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@/lib/router";
import { EnrolDialog } from "@/components/EnrolDialog";
import { useDb } from "@/data/store";
import { getBatch, getCourse, getStudent, getUser, openBatches, seatsFilled } from "@/data/selectors";
import type { Enrolment, ID } from "@/data/types";
import { Button, Card, DataTable, EmptyState, FilterBar, NameCell, StatCard, StatGrid, StatusChip } from "@/design-system";
import { formatDate, formatINR, formatNumber, formatRelative } from "@/lib/format";
import { dateKey, DEFAULT_TZ } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { shortCourse } from "./leads/leadUtils";
import "./admissions.css";

const PAGE = 25;

const STATUS_FILTER = [
  { value: "active", label: "Enrolled" },
  { value: "completed", label: "Completed" },
  { value: "transferred", label: "Transferred" },
  { value: "dropped", label: "Dropped" },
];

export function EnrolmentStatusChip({ status }: { status: Enrolment["status"] }) {
  if (status === "active") return <StatusChip status="enrolled" />;
  if (status === "completed") return <StatusChip status="completed" />;
  if (status === "transferred")
    return (
      <StatusChip status="transferred" tone="warning">
        Transferred
      </StatusChip>
    );
  return (
    <StatusChip status="dropped" tone="danger">
      Dropped
    </StatusChip>
  );
}

/** Enrolments: selected leads waiting for a batch, and every enrolment so far. */
export function EnrolmentsPage() {
  const db = useDb();
  const now = useNow(60000);
  const nav = useNavigate();
  const [enrolLeadId, setEnrolLeadId] = useState<ID | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [batchId, setBatchId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(0);

  const selected = useMemo(() => db.leads.filter((l) => l.stage === "selected").sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)), [db.leads]);

  const stats = useMemo(() => {
    const month = dateKey(new Date(now), DEFAULT_TZ).slice(0, 7);
    const thisMonth = db.enrolments.filter((e) => dateKey(e.enrolledAt, DEFAULT_TZ).slice(0, 7) === month && e.status !== "transferred");
    const open = openBatches(db, now);
    return {
      count: thisMonth.length,
      fees: thisMonth.reduce((s, e) => s + e.feePaid, 0),
      seats: open.reduce((s, b) => s + (b.capacity - seatsFilled(db, b.id)), 0),
      openBatches: open.length,
    };
  }, [db, now]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.enrolments
      .filter((e) => {
        if (batchId && e.batchId !== batchId) return false;
        if (status && e.status !== status) return false;
        if (s) {
          const st = getStudent(db, e.studentId);
          if (!st || !(st.name.toLowerCase().includes(s) || st.email.toLowerCase().includes(s))) return false;
        }
        return true;
      })
      .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
  }, [db, q, batchId, status]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);
  const filterChange = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  return (
    <AdminPage
      title="Enrolments"
      breadcrumb={<Crumbs items={[{ label: "Admissions" }, { label: "Enrolments" }]} />}
      actions={
        <Button icon="plus" onClick={() => setAdding(true)}>
          Add student
        </Button>
      }
    >
      <StatGrid>
        <StatCard title="Enrolled this month" value={formatNumber(stats.count)} delta="Since the 1st" />
        <StatCard title="Fees collected" value={formatINR(stats.fees)} delta="Enrolments this month" />
        <StatCard title="Awaiting enrolment" value={formatNumber(selected.length)} delta="Selected leads" />
        <StatCard title="Seats open" value={formatNumber(stats.seats)} delta={`Across ${stats.openBatches} open batches`} />
      </StatGrid>

      <Card title="Selected, awaiting enrolment" description="Offer made. Enrol them in a batch with seats left to create their student account." flush>
        {selected.length ? (
          <ul className="list">
            {selected.map((l) => (
              <li key={l.id} className="adm-wrap">
                <div className="adm-grow">
                  <Link to={`/admin/leads?lead=${l.id}`} className="list-title" style={{ textDecoration: "none", color: "var(--ink)" }}>
                    {l.name}
                  </Link>
                  <div className="list-sub">
                    {shortCourse(getCourse(db, l.courseId)?.title)} · {getUser(db, l.ownerId)?.name || "Unassigned"} · selected {formatRelative(l.updatedAt, now).replace(/^[A-Z]/, (c) => c.toLowerCase())}
                  </div>
                </div>
                <div className="adm-actions">
                  <Button variant="secondary" icon="graduation" onClick={() => setEnrolLeadId(l.id)}>
                    Enrol student
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="graduation"
            title="No selected leads waiting"
            description="Leads you move to Selected appear here, ready to enrol."
            action={
              <Button variant="secondary" icon="inbox" onClick={() => nav("/admin/leads")}>
                Open Leads CRM
              </Button>
            }
          />
        )}
      </Card>

      <DataTable<Enrolment>
        toolbar={
          <FilterBar
            searchPlaceholder="Search student name or email"
            searchValue={q}
            onSearch={filterChange(setQ)}
            filters={[
              { label: "Batch", value: batchId ? getBatch(db, batchId)?.code : undefined, options: db.batches.map((b) => ({ value: b.id, label: b.code })), onSelect: filterChange(setBatchId) },
              { label: "Status", value: STATUS_FILTER.find((s) => s.value === status)?.label, options: STATUS_FILTER, onSelect: filterChange(setStatus) },
            ]}
          />
        }
        rows={shown}
        onRowClick={(e) => nav(`/admin/students/${e.studentId}`)}
        empty={<EmptyState icon="search" title="No enrolments match these filters" description="Try a different search, batch or status." />}
        footer={
          rows.length ? (
            <>
              <span>
                Showing {formatNumber(current * PAGE + 1)}–{formatNumber(current * PAGE + shown.length)} of {formatNumber(rows.length)}
              </span>
              <span className="adm-pager">
                <Button variant="secondary" icon="chevronLeft" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} />
                <Button variant="secondary" icon="chevronRight" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} />
              </span>
            </>
          ) : undefined
        }
        columns={[
          {
            key: "student",
            label: "Student",
            render: (e) => {
              const s = getStudent(db, e.studentId);
              return <NameCell name={s?.name || "Removed student"} sub={s?.email} />;
            },
          },
          {
            key: "batch",
            label: "Batch",
            render: (e) => {
              const b = getBatch(db, e.batchId);
              return <NameCell name={<span className="bl-mono">{b?.code}</span>} sub={b ? shortCourse(getCourse(db, b.courseId)?.title) : undefined} />;
            },
          },
          { key: "enrolledAt", label: "Enrolled on", render: (e) => <span className="nowrap">{formatDate(e.enrolledAt)}</span> },
          { key: "fee", label: "Fee paid", numeric: true, render: (e) => formatINR(e.feePaid) },
          { key: "status", label: "Status", render: (e) => <EnrolmentStatusChip status={e.status} /> },
        ]}
      />

      <EnrolDialog open={!!enrolLeadId} leadId={enrolLeadId || undefined} onClose={() => setEnrolLeadId(null)} />
      <EnrolDialog open={adding} onClose={() => setAdding(false)} />
    </AdminPage>
  );
}
