"use client";
import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useDb } from "@/data/store";
import type { Course } from "@/data/types";
import { Button, DataTable, EmptyState, FilterBar, NameCell, type Column } from "@/design-system";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { formatINR, formatNumber, plural } from "@/lib/format";
import { CourseStatusChip, MaterialsChip, templateCount } from "./courses/courseBits";
import { NewCourseDialog } from "./courses/NewCourseDialog";
import "./academics.css";

interface Row extends Course {
  lectures: number;
  batches: number;
}

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

export function CoursesPage() {
  const db = useDb();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>();
  const [level, setLevel] = useState<string>();
  const [creating, setCreating] = useState(false);

  const all = useMemo<Row[]>(
    () =>
      db.courses
        .map((c) => ({ ...c, lectures: templateCount(c), batches: db.batches.filter((b) => b.courseId === c.id && b.lifecycle !== "cancelled").length }))
        .sort((a, b) => Number(a.status === "draft") - Number(b.status === "draft") || a.title.localeCompare(b.title)),
    [db.courses, db.batches],
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((c) => (!status || c.status === status) && (!level || c.level === level) && (!s || c.title.toLowerCase().includes(s) || c.code.toLowerCase().includes(s)));
  }, [all, q, status, level]);

  const filtered = !!(q.trim() || status || level);

  const columns: Column<Row>[] = [
    {
      key: "title",
      label: "Course",
      render: (c) => (
        <NameCell
          name={c.title}
          sub={
            <>
              <span className="bl-mono">{c.code}</span> · {c.level}
            </>
          }
        />
      ),
    },
    { key: "lectures", label: "Lectures", numeric: true, render: (c) => formatNumber(c.lectures) },
    { key: "duration", label: "Duration", render: (c) => <span className="nowrap">{plural(c.durationWeeks, "week")}</span> },
    { key: "fee", label: "Fee", numeric: true, render: (c) => formatINR(c.fee) },
    { key: "batches", label: "Batches", numeric: true, render: (c) => formatNumber(c.batches) },
    { key: "materials", label: "Materials", render: (c) => <MaterialsChip on={c.materialsEnabled} /> },
    { key: "status", label: "Status", render: (c) => <CourseStatusChip course={c} /> },
  ];

  return (
    <AdminPage
      title="Courses"
      breadcrumb={<Crumbs items={[{ label: "Curriculum" }, { label: "Courses" }]} />}
      actions={
        <Button icon="plus" onClick={() => setCreating(true)}>
          New course
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(c) => nav(`/admin/courses/${c.id}`)}
        toolbar={
          <FilterBar
            searchPlaceholder="Search courses"
            searchValue={q}
            onSearch={setQ}
            filters={[
              { label: "Status", value: STATUS_OPTIONS.find((o) => o.value === status)?.label, options: STATUS_OPTIONS, onSelect: setStatus },
              { label: "Level", value: level, options: ["Beginner", "Intermediate", "Advanced"], onSelect: setLevel },
            ]}
          />
        }
        footer={<span>{`Showing ${rows.length} of ${plural(all.length, "course")}`}</span>}
        empty={
          filtered ? (
            <EmptyState
              icon="search"
              title="No courses match these filters"
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setStatus(undefined);
                    setLevel(undefined);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="book"
              title="No courses yet"
              description="A course is the reusable curriculum. Create one, add its modules and lectures, then Operations can schedule batches of it."
              action={
                <Button icon="plus" onClick={() => setCreating(true)}>
                  New course
                </Button>
              }
            />
          )
        }
      />
      <NewCourseDialog open={creating} onClose={() => setCreating(false)} onCreated={(c) => nav(`/admin/courses/${c.id}`)} />
    </AdminPage>
  );
}
