"use client";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import { EnrolDialog } from "@/components/EnrolDialog";
import { useDb } from "@/data/store";
import { Button, DataTable, EmptyState, FilterBar, NameCell, Progress, StatusChip } from "@/design-system";
import { formatNumber } from "@/lib/format";
import { dateKey, DEFAULT_TZ } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { buildStudentRows, DIRECTORY_STATUS_LABEL, downloadCsv, type DirectoryStatus, type StudentRow } from "./students/studentRows";
import "./admissions.css";

const PAGE = 25;

export function StatusCell({ status }: { status: DirectoryStatus }) {
  return status === "none" ? <StatusChip status="not-enrolled" tone="neutral">Not enrolled</StatusChip> : <StatusChip status={status} />;
}

/** Student Directory. */
export function StudentsPage() {
  const db = useDb();
  const now = useNow(60000);
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [batchId, setBatchId] = useState<string | undefined>();
  const [status, setStatus] = useState<DirectoryStatus | undefined>();
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);

  const all = useMemo(() => buildStudentRows(db, now), [db, now]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return all
      .filter((r) => {
        if (batchId && !r.batches.some((b) => b.id === batchId)) return false;
        if (status && r.status !== status) return false;
        if (s) {
          const st = r.student;
          const hit = st.name.toLowerCase().includes(s) || st.email.toLowerCase().includes(s) || (st.city || "").toLowerCase().includes(s) || (digits.length >= 3 && st.phone.replace(/\D/g, "").includes(digits));
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [all, q, batchId, status]);

  useEffect(() => setPage(0), [q, batchId, status]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);
  const anyFilter = !!(q.trim() || batchId || status);

  const exportCsv = () => {
    downloadCsv(`students-${dateKey(new Date(now), DEFAULT_TZ)}.csv`, [
      ["Name", "Email", "Phone", "City", "Batches", "Status", "Progress %", "Verified attendance"],
      ...rows.map((r) => [r.student.name, r.student.email, r.student.phone, r.student.city || "", r.batches.map((b) => b.code).join(" "), DIRECTORY_STATUS_LABEL[r.status], String(r.progress), r.held ? `${r.present}/${r.held}` : ""]),
    ]);
  };

  return (
    <AdminPage
      title="Student Directory"
      breadcrumb={<Crumbs items={[{ label: "Delivery" }, { label: "Students" }]} />}
      actions={
        <Button icon="plus" onClick={() => setAdding(true)}>
          Add student
        </Button>
      }
    >
      <DataTable<StudentRow>
        toolbar={
          <FilterBar
            searchPlaceholder="Search name, email, phone or city"
            searchValue={q}
            onSearch={setQ}
            filters={[
              { label: "Batch", value: batchId ? db.batches.find((b) => b.id === batchId)?.code : undefined, options: db.batches.map((b) => ({ value: b.id, label: b.code })), onSelect: setBatchId },
              {
                label: "Status",
                value: status ? DIRECTORY_STATUS_LABEL[status] : undefined,
                options: (Object.keys(DIRECTORY_STATUS_LABEL) as DirectoryStatus[]).map((k) => ({ value: k, label: DIRECTORY_STATUS_LABEL[k] })),
                onSelect: (v) => setStatus(v as DirectoryStatus | undefined),
              },
            ]}
            end={
              <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!rows.length} title={rows.length ? undefined : "No students to export"}>
                Export CSV
              </Button>
            }
          />
        }
        rows={shown}
        onRowClick={(r) => nav(`/admin/students/${r.id}`)}
        empty={
          anyFilter ? (
            <EmptyState
              icon="search"
              title="No students match these filters"
              description="Try a different search, batch or status."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setBatchId(undefined);
                    setStatus(undefined);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon="users" title="No students yet" description="Students appear here when a lead is enrolled or you add one directly." action={<Button icon="plus" onClick={() => setAdding(true)}>Add student</Button>} />
          )
        }
        footer={
          rows.length ? (
            <>
              <span>
                Showing {formatNumber(current * PAGE + 1)}–{formatNumber(current * PAGE + shown.length)} of {formatNumber(rows.length)}
              </span>
              <span className="adm-pager">
                <span className="nowrap">
                  Page {current + 1} of {pages}
                </span>
                <Button variant="secondary" icon="chevronLeft" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} />
                <Button variant="secondary" icon="chevronRight" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} />
              </span>
            </>
          ) : undefined
        }
        columns={[
          { key: "name", label: "Student", render: (r) => <NameCell name={r.student.name} sub={r.student.email} /> },
          { key: "batch", label: "Batch", render: (r) => (r.batches.length ? <span className="bl-mono nowrap">{r.batches.map((b) => b.code).join(", ")}</span> : "—") },
          { key: "status", label: "Status", render: (r) => <StatusCell status={r.status} /> },
          {
            key: "progress",
            label: "Progress",
            width: 160,
            render: (r) =>
              r.primary ? (
                <div className="adm-progress-row">
                  <Progress value={r.progress} label={`${r.student.name} progress`} />
                  <span className="bl-mono" style={{ fontSize: 12 }}>
                    {r.progress}%
                  </span>
                </div>
              ) : (
                "—"
              ),
          },
          { key: "att", label: "Verified attendance", numeric: true, render: (r) => (r.held ? `${r.present}/${r.held}` : "—") },
          { key: "city", label: "City", render: (r) => r.student.city || "—" },
        ]}
      />
      <p className="caption">Progress is the share of a batch's lectures the student was verified present for. Join clicks don't count until attendance is verified.</p>
      <EnrolDialog open={adding} onClose={() => setAdding(false)} />
    </AdminPage>
  );
}
