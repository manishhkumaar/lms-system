"use client";
import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import { BatchChip } from "@/components/StatusChips";
import { useDb } from "@/data/store";
import { batchStateIn, getCourse, seatsFilled, type BatchState } from "@/data/selectors";
import type { Batch } from "@/data/types";
import { Button, DataTable, EmptyState, FilterBar, NameCell, Progress, StatCard, StatGrid, statusLabel, type Column } from "@/design-system";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { formatNumber, plural } from "@/lib/format";
import { tzLabel } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { datesLabel, daysLabel } from "./batches/batchFormat";
import "./academics.css";

interface Row extends Batch {
  state: BatchState;
  filled: number;
  courseTitle: string;
}

const ORDER: BatchState[] = ["ongoing", "upcoming", "full", "draft", "completed", "cancelled"];

/** Batch Management: every scheduled delivery of every course. */
export function BatchesPage() {
  const db = useDb();
  const nav = useNavigate();
  const now = useNow(60000);
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState<string>();
  const [state, setState] = useState<BatchState>();

  const all = useMemo<Row[]>(
    () =>
      db.batches
        .map((b) => ({ ...b, state: batchStateIn(db, b, now), filled: seatsFilled(db, b.id), courseTitle: getCourse(db, b.courseId)?.title || "—" }))
        .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.startDate.localeCompare(b.startDate)),
    [db, now],
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter(
      (b) =>
        (!courseId || b.courseId === courseId) &&
        (!state || b.state === state) &&
        (!s || b.name.toLowerCase().includes(s) || b.code.toLowerCase().includes(s) || b.instructors.some((i) => i.toLowerCase().includes(s))),
    );
  }, [all, q, courseId, state]);
  const filtered = !!(q.trim() || courseId || state);

  const stats = useMemo(() => {
    const running = all.filter((b) => b.state === "ongoing");
    const open = all.filter((b) => b.state === "upcoming" || b.state === "full");
    const active = [...running, ...open];
    const seats = active.reduce((n, b) => n + b.capacity, 0);
    const filled = active.reduce((n, b) => n + b.filled, 0);
    const weekEnd = now + 7 * 86400000;
    const thisWeek = db.lectures.filter((l) => l.status !== "cancelled" && new Date(l.start).getTime() >= now && new Date(l.start).getTime() < weekEnd).length;
    return { running: running.length, open: open.length, seats, filled, thisWeek, full: open.filter((b) => b.state === "full").length };
  }, [all, db.lectures, now]);

  const columns: Column<Row>[] = [
    { key: "name", label: "Batch", render: (b) => <NameCell name={b.name} sub={<span className="bl-mono">{b.code}</span>} /> },
    { key: "course", label: "Course", render: (b) => b.courseTitle },
    { key: "dates", label: "Dates", render: (b) => <span className="nowrap">{datesLabel(b)}</span> },
    {
      key: "schedule",
      label: "Schedule",
      render: (b) => (
        <span className="nowrap">
          {daysLabel(b.days)} · <span className="bl-mono">{`${b.slotStart}–${b.slotEnd}`}</span> {tzLabel(b.timeZone)}
        </span>
      ),
    },
    {
      key: "seats",
      label: "Seats",
      width: 180,
      render: (b) => (
        <span className="acd-seats">
          <Progress value={(b.filled / b.capacity) * 100} label={`${b.filled} of ${b.capacity} seats filled`} />
          <span>
            {b.filled} of {b.capacity}
          </span>
        </span>
      ),
    },
    { key: "status", label: "Status", render: (b) => <BatchChip batch={b} now={now} /> },
  ];

  return (
    <AdminPage
      title="Batch Management"
      breadcrumb={<Crumbs items={[{ label: "Delivery" }, { label: "Batches" }]} />}
      actions={
        <Button icon="plus" onClick={() => nav("/admin/batches/new")}>
          New batch
        </Button>
      }
    >
      <StatGrid>
        <StatCard title="Ongoing batches" value={formatNumber(stats.running)} delta={`${plural(stats.thisWeek, "lecture")} in the next 7 days`} />
        <StatCard title="Open for enrolment" value={formatNumber(stats.open)} delta={stats.full ? `${stats.full} full` : "Upcoming batches with seats"} />
        <StatCard title="Seats filled" value={`${formatNumber(stats.filled)}`} delta={`of ${formatNumber(stats.seats)} in ongoing and upcoming batches`} />
        <StatCard title="Fill rate" value={stats.seats ? `${Math.round((stats.filled / stats.seats) * 100)}%` : "—"} delta="Ongoing and upcoming batches" />
      </StatGrid>
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(b) => nav(`/admin/batches/${b.id}`)}
        toolbar={
          <FilterBar
            searchPlaceholder="Search batches or instructors"
            searchValue={q}
            onSearch={setQ}
            filters={[
              { label: "Course", value: getCourse(db, courseId)?.title, options: db.courses.map((c) => ({ value: c.id, label: c.title })), onSelect: setCourseId },
              { label: "Status", value: state ? statusLabel(state) : undefined, options: ORDER.map((s) => ({ value: s, label: statusLabel(s) })), onSelect: (v) => setState(v as BatchState | undefined) },
            ]}
          />
        }
        footer={<span>{`Showing ${rows.length} of ${plural(all.length, "batch", "batches")}`}</span>}
        empty={
          filtered ? (
            <EmptyState
              icon="search"
              title="No batches match these filters"
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setCourseId(undefined);
                    setState(undefined);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="layers"
              title="No batches yet"
              description="A batch is one scheduled delivery of a course: dates, seats, instructors and its lectures."
              action={
                <Button icon="plus" onClick={() => nav("/admin/batches/new")}>
                  New batch
                </Button>
              }
            />
          )
        }
      />
    </AdminPage>
  );
}
