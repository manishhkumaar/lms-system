"use client";
import "./delivery.css";
import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { LectureChip } from "@/components/StatusChips";
import { useRun } from "@/components/useRun";
import { importProviderAttendance } from "@/data/actions";
import { useDb } from "@/data/store";
import { batchLectures, batchStateIn, batchStudents, getBatch, isEnded, lectureAttendance, studentAttendance, verifiedAttendanceRate } from "@/data/selectors";
import type { Lecture, Student } from "@/data/types";
import { Button, Card, DataTable, EmptyState, NameCell, Progress, SelectField, StatCard, StatGrid, useToast, type Column } from "@/design-system";
import { formatDate, formatNumber, formatRange24, formatWhen, plural } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { AdminPage } from "@/layouts/AdminPage";
import { navBreadcrumb, useViewerZone } from "./delivery/shared";

interface LectureRow {
  id: string;
  lecture: Lecture;
  joined: number;
  present: number;
  absent: number;
  unverified: number;
  expected: number;
}

interface LowRow {
  student: Student;
  present: number;
  held: number;
  pct: number;
}

/** Attendance: verified presence per batch and per lecture. Joined is never counted as attended. */
export function AttendancePage() {
  const db = useDb();
  const user = useUser();
  const now = useNow(30000);
  const nav = useNavigate();
  const run = useRun();
  const toast = useToast();
  const { tz, label } = useViewerZone();
  const [params, setParams] = useSearchParams();

  const batches = useMemo(() => db.batches.filter((b) => b.lifecycle !== "draft"), [db.batches]);
  const defaultBatch = useMemo(() => batches.find((b) => batchStateIn(db, b, now) === "ongoing")?.id || batches[0]?.id, [db, batches, now]);
  const requested = params.get("batch");
  const batchId = requested && batches.some((b) => b.id === requested) ? requested : defaultBatch;
  const batch = getBatch(db, batchId);

  const data = useMemo(() => {
    if (!batch) return null;
    const lectures = batchLectures(db, batch.id);
    const held = lectures.filter((l) => isEnded(l, now)).reverse();
    const rows: LectureRow[] = held.map((l) => {
      const a = lectureAttendance(db, l);
      return { id: l.id, lecture: l, joined: a.joined, present: a.present, absent: a.absent, unverified: a.unverified, expected: a.expected };
    });
    const rate = verifiedAttendanceRate(db, now, { batchId: batch.id });
    const unverifiedLectures = rows.filter((r) => r.unverified > 0).length;
    const avgJoined = rows.length ? (rows.reduce((s, r) => s + (r.expected ? r.joined / r.expected : 0), 0) / rows.length) * 100 : 0;
    const low: LowRow[] = batchStudents(db, batch.id)
      .map((s) => {
        const a = studentAttendance(db, s.id, batch.id, now);
        return { student: s, present: a.present, held: a.held, pct: a.pct };
      })
      .filter((x) => x.held > 0 && x.pct < 75)
      .sort((a, b) => a.pct - b.pct || a.student.name.localeCompare(b.student.name));
    const planned = lectures.filter((l) => l.status !== "cancelled").length;
    const next = lectures.find((l) => l.status !== "cancelled" && !isEnded(l, now));
    return { rows, rate, unverifiedLectures, avgJoined, low, planned, next };
  }, [db, batch, now]);

  const importFor = async (l: Lecture) => {
    const res = await run(() => importProviderAttendance(l.id));
    if (res) toast({ title: "Provider attendance imported", description: `Lecture ${l.number}: ${res.present} present · ${res.absent} absent.`, tone: "success" });
  };

  const columns: Column<LectureRow>[] = [
    { key: "no", label: "No.", numeric: true, width: 56, render: (r) => r.lecture.number },
    { key: "title", label: "Lecture", render: (r) => <NameCell name={r.lecture.title} sub={r.lecture.instructor} /> },
    {
      key: "date",
      label: "Date",
      render: (r) => (
        <span className="bl-mono nowrap">
          {formatDate(r.lecture.start, tz)} · {formatRange24(r.lecture.start, r.lecture.end, tz)} {label}
        </span>
      ),
    },
    { key: "joined", label: "Joined (clicks)", numeric: true, render: (r) => r.joined },
    { key: "present", label: "Verified present", numeric: true, render: (r) => r.present },
    { key: "absent", label: "Absent", numeric: true, render: (r) => r.absent },
    { key: "unverified", label: "Unverified", numeric: true, render: (r) => <span className={r.unverified ? "text-warning" : undefined}>{r.unverified}</span> },
    { key: "status", label: "Status", render: (r) => <LectureChip lecture={r.lecture} now={now} /> },
    {
      key: "action",
      label: <span className="visually-hidden">Actions</span>,
      render: (r) =>
        r.unverified > 0 ? (
          <div className="dlv-row-actions">
            <Button
              variant="ghost"
              icon="checklist"
              onClick={(e) => {
                e.stopPropagation();
                void importFor(r.lecture);
              }}
            >
              Import from provider
            </Button>
          </div>
        ) : null,
    },
  ];

  const canOpenStudents = canAccess(user.role, "students");

  return (
    <AdminPage title="Attendance" breadcrumb={navBreadcrumb(user.role, "attendance", "Attendance")}>
      {!batches.length ? (
        <div className="bl-card">
          <EmptyState icon="checklist" title="No batches yet" description="Verified attendance appears here once a batch has held its first lecture." />
        </div>
      ) : (
        <>
          <div className="dlv-picker">
            <SelectField
              label="Batch"
              value={batchId}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set("batch", e.target.value);
                setParams(next, { replace: true });
              }}
              options={batches.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
            />
            <p className="caption" style={{ paddingBottom: 10 }}>
              Only verified presence counts. A Join click shows as Joined until the provider or Operations confirms it.
            </p>
          </div>

          {batch && data ? (
            <>
              <StatGrid>
                <StatCard
                  title="Verified attendance"
                  value={data.rows.length ? `${Math.round(data.rate.pct)}%` : "—"}
                  delta={data.rows.length ? `${formatNumber(data.rate.present)} of ${formatNumber(data.rate.expected)} student-lectures` : "No lectures held yet"}
                />
                <StatCard title="Lectures held" value={formatNumber(data.rows.length)} delta={`of ${plural(data.planned, "lecture")} planned`} />
                <StatCard
                  title="Unverified lectures"
                  value={formatNumber(data.unverifiedLectures)}
                  delta={data.unverifiedLectures ? "Import from the provider or review" : "All held lectures verified"}
                />
                <StatCard title="Average joined" value={data.rows.length ? `${Math.round(data.avgJoined)}%` : "—"} delta="Join clicks, not attendance" />
              </StatGrid>

              {data.rows.length ? (
                <div className="split">
                  <DataTable
                    columns={columns}
                    rows={data.rows}
                    onRowClick={(r) => nav(`/admin/lectures/${r.lecture.id}`)}
                    footer={
                      <span>
                        {plural(data.rows.length, "lecture")} held in {batch.code}. Times in {label}.
                      </span>
                    }
                  />
                  <Card
                    flush
                    title="Students below 75% verified attendance"
                    description="Unverified lectures count as not present until they're verified."
                    actions={data.low.length ? <span className="bl-mono subtle">{data.low.length}</span> : undefined}
                  >
                    {data.low.length ? (
                      <ul className="list">
                        {data.low.map((x) => (
                          <li key={x.student.id}>
                            <div className="dlv-low">
                              <div style={{ minWidth: 0 }}>
                                <div className="list-title ellipsis">
                                  {canOpenStudents ? <Link to={`/admin/students/${x.student.id}`}>{x.student.name}</Link> : x.student.name}
                                </div>
                                <div className="list-sub">
                                  {x.present} of {plural(x.held, "lecture")} verified present
                                </div>
                              </div>
                              <Progress value={x.pct} label={`${x.student.name}: ${Math.round(x.pct)}% verified attendance`} />
                              <span className="dlv-low-pct">{Math.round(x.pct)}%</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="dlv-low-empty">Everyone in {batch.code} is at 75% or above.</p>
                    )}
                  </Card>
                </div>
              ) : (
                <div className="bl-card">
                  <EmptyState
                    icon="calendar"
                    title="No lectures held yet"
                    description={
                      data.next
                        ? `Attendance appears here after the first lecture of ${batch.code}: ${formatWhen(data.next.start, data.next.end, tz)}.`
                        : `${batch.code} has no lectures scheduled yet.`
                    }
                  />
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </AdminPage>
  );
}
