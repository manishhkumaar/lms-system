"use client";
import "./delivery.css";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "@/lib/router";
import { canAccess } from "@/core/access";
import { useUser } from "@/auth/AuthContext";
import { UploadRecordingDialog } from "@/components/UploadRecordingDialog";
import { useRun } from "@/components/useRun";
import { setRecordingPublished } from "@/data/actions";
import { useDb } from "@/data/store";
import { getBatch, getLecture, isEnded, recordingForLecture } from "@/data/selectors";
import type { Batch, Lecture, Recording } from "@/data/types";
import { Banner, Button, DataTable, EmptyState, FilterBar, NameCell, StatusChip, Tabs, type Column } from "@/design-system";
import { formatDate, formatDuration, formatNumber, formatRange24, formatRelative, plural } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { AdminPage } from "@/layouts/AdminPage";
import { DAY_MS, lectureRef, navBreadcrumb, useViewerZone } from "./delivery/shared";

const PAGE = 20;

interface RecRow {
  id: string;
  rec: Recording;
  lecture: Lecture | undefined;
  batch: Batch | undefined;
}

interface AwaitRow {
  id: string;
  lecture: Lecture;
}

const VISIBILITY = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

/** Recordings: what's waiting to be uploaded, and every recording with its visibility. */
export function RecordingsPage() {
  const db = useDb();
  const user = useUser();
  const now = useNow(5000);
  const nav = useNavigate();
  const run = useRun();
  const { tz, label } = useViewerZone();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [upload, setUpload] = useState<{ lectureId?: string } | null>(null);

  const awaiting = useMemo<AwaitRow[]>(
    () =>
      db.lectures
        .filter((l) => isEnded(l, now) && now - new Date(l.end).getTime() < 30 * DAY_MS && !recordingForLecture(db, l.id))
        .sort((a, b) => b.end.localeCompare(a.end))
        .map((l) => ({ id: l.id, lecture: l })),
    [db, now],
  );

  const tab = params.get("tab") === "awaiting" || params.get("tab") === "all" ? params.get("tab")! : awaiting.length ? "awaiting" : "all";
  const batchId = params.get("batch") || undefined;
  const vis = params.get("visibility") || undefined;
  const setParam = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
    setPage(1);
  };

  const all = useMemo<RecRow[]>(
    () =>
      db.recordings
        .map((r) => ({ id: r.id, rec: r, lecture: getLecture(db, r.lectureId), batch: getBatch(db, r.batchId) }))
        .sort((a, b) => (b.lecture?.start || b.rec.uploadedAt).localeCompare(a.lecture?.start || a.rec.uploadedAt)),
    [db],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((r) => {
      if (batchId && r.rec.batchId !== batchId) return false;
      if (vis === "visible" && !(r.rec.status === "ready" && r.rec.published)) return false;
      if (vis === "hidden" && r.rec.status === "ready" && r.rec.published) return false;
      if (s && ![r.rec.title, r.batch?.code, r.batch?.name, r.rec.fileName].some((x) => x?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [all, batchId, vis, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const p = Math.min(page, pages);
  const pageRows = filtered.slice((p - 1) * PAGE, p * PAGE);
  const batchOptions = useMemo(() => {
    const ids = new Set(db.recordings.map((r) => r.batchId));
    return db.batches.filter((b) => ids.has(b.id)).map((b) => ({ value: b.id, label: b.code }));
  }, [db]);

  const toggle = (r: RecRow) => {
    const on = !r.rec.published;
    void run(
      () => setRecordingPublished(r.rec.id, on),
      on ? "Recording published" : "Recording hidden",
      on ? `Students in ${r.batch?.code} can watch it now.` : `Students in ${r.batch?.code} no longer see it.`,
    );
  };

  const recColumns: Column<RecRow>[] = [
    { key: "title", label: "Recording", render: (r) => <NameCell name={r.rec.title} sub={r.lecture ? lectureRef(db, r.lecture) : r.batch?.code} /> },
    { key: "date", label: "Date", render: (r) => <span className="bl-mono nowrap">{formatDate(r.lecture?.start || r.rec.uploadedAt, tz)}</span> },
    { key: "duration", label: "Duration", render: (r) => <span className="nowrap">{formatDuration(r.rec.durationMins)}</span> },
    { key: "status", label: "Status", render: (r) => <StatusChip status={r.rec.status === "ready" ? "recording-ready" : "recording-processing"} /> },
    {
      key: "visible",
      label: "Visible to students",
      render: (r) =>
        r.rec.status !== "ready" ? (
          <span className="caption">Hidden until processing finishes</span>
        ) : (
          <span className="dlv-vis">
            <span>{r.rec.published ? "Visible" : "Hidden"}</span>
            <Button
              variant="ghost"
              icon={r.rec.published ? "x" : "check"}
              onClick={(e) => {
                e.stopPropagation();
                toggle(r);
              }}
            >
              {r.rec.published ? "Hide" : "Publish to batch"}
            </Button>
          </span>
        ),
    },
    { key: "views", label: "Views", numeric: true, render: (r) => formatNumber(r.rec.views) },
    { key: "size", label: "Size (MB)", numeric: true, render: (r) => formatNumber(r.rec.sizeMb) },
  ];

  const awaitColumns: Column<AwaitRow>[] = [
    { key: "lecture", label: "Lecture", render: (r) => <NameCell name={r.lecture.title} sub={lectureRef(db, r.lecture)} /> },
    { key: "batch", label: "Batch", render: (r) => getBatch(db, r.lecture.batchId)?.name ?? "—" },
    {
      key: "ended",
      label: "Ended",
      render: (r) => (
        <span className="nowrap">
          <span className="bl-mono">
            {formatDate(r.lecture.start, tz)} · {formatRange24(r.lecture.start, r.lecture.end, tz)} {label}
          </span>
          <span className="bl-cell-sub">{formatRelative(r.lecture.end, now, tz)}</span>
        </span>
      ),
    },
    {
      key: "action",
      label: <span className="visually-hidden">Actions</span>,
      render: (r) => (
        <div className="dlv-row-actions">
          <Button
            variant="secondary"
            icon="upload"
            onClick={(e) => {
              e.stopPropagation();
              setUpload({ lectureId: r.lecture.id });
            }}
          >
            Upload recording
          </Button>
        </div>
      ),
    },
  ];

  const unpublishedReady = db.recordings.filter((r) => r.status === "ready" && !r.published).length;

  return (
    <AdminPage
      title="Recordings"
      breadcrumb={navBreadcrumb(user.role, "recordings", "Recordings")}
      actions={
        <Button icon="upload" onClick={() => setUpload({})}>
          Upload recording
        </Button>
      }
    >
      {!db.settings.autoPublishRecordings ? (
        <Banner
          tone="info"
          action={
            canAccess(user.role, "settings") ? (
              <Link to="/admin/settings" className="bl-btn bl-btn-secondary" style={{ textDecoration: "none" }}>
                Open settings
              </Link>
            ) : undefined
          }
        >
          Recordings stay hidden from students until you publish them. Change this in Settings.
          {unpublishedReady ? ` ${plural(unpublishedReady, "recording")} ${unpublishedReady === 1 ? "is" : "are"} ready to publish.` : ""}
        </Banner>
      ) : null}

      <Tabs
        value={tab}
        onChange={(v) => setParam("tab", v)}
        items={[
          { value: "awaiting", label: "Awaiting upload", count: awaiting.length },
          { value: "all", label: "All recordings", count: db.recordings.length },
        ]}
      />

      {tab === "awaiting" ? (
        <DataTable
          columns={awaitColumns}
          rows={awaiting}
          onRowClick={(r) => nav(`/admin/lectures/${r.lecture.id}`)}
          empty={<EmptyState icon="check" title="Every finished lecture has its recording" description="Lectures that ended in the last 30 days without a recording show up here." />}
          footer={awaiting.length ? <span>{plural(awaiting.length, "lecture")} from the last 30 days without a recording</span> : undefined}
        />
      ) : db.recordings.length === 0 ? (
        <div className="bl-card">
          <EmptyState
            icon="video"
            title="No recordings yet"
            description="Recordings appear here after each lecture once Operations uploads them."
            action={
              <Button variant="secondary" icon="calendar" onClick={() => nav("/admin/schedule")}>
                View schedule
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          columns={recColumns}
          rows={pageRows}
          onRowClick={(r) => r.lecture && nav(`/admin/lectures/${r.lecture.id}`)}
          toolbar={
            <FilterBar
              searchPlaceholder="Search recordings"
              searchValue={q}
              onSearch={(v) => {
                setQ(v);
                setPage(1);
              }}
              filters={[
                { label: "Batch", value: getBatch(db, batchId)?.code, options: batchOptions, onSelect: (v) => setParam("batch", v) },
                { label: "Visibility", value: VISIBILITY.find((o) => o.value === vis)?.label, options: VISIBILITY, onSelect: (v) => setParam("visibility", v) },
              ]}
            />
          }
          empty={
            <EmptyState
              icon="filter"
              title="No recordings match these filters"
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setParams(new URLSearchParams({ tab: "all" }), { replace: true });
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
          footer={
            filtered.length ? (
              <>
                <span>
                  Showing {formatNumber((p - 1) * PAGE + 1)}–{formatNumber(Math.min(p * PAGE, filtered.length))} of {formatNumber(filtered.length)}
                </span>
                <span className="dlv-pager">
                  <Button variant="secondary" icon="chevronLeft" aria-label="Previous page" disabled={p <= 1} onClick={() => setPage(p - 1)} />
                  <Button variant="secondary" icon="chevronRight" aria-label="Next page" disabled={p >= pages} onClick={() => setPage(p + 1)} />
                </span>
              </>
            ) : undefined
          }
        />
      )}

      <UploadRecordingDialog open={!!upload} onClose={() => setUpload(null)} lectureId={upload?.lectureId} />
    </AdminPage>
  );
}
