"use client";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRun } from "@/components/useRun";
import { removeMaterial } from "@/data/actions";
import { useDb } from "@/data/store";
import { getCourse } from "@/data/selectors";
import type { Material, MaterialKind } from "@/data/types";
import { Button, EmptyState, FilterBar } from "@/design-system";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { plural } from "@/lib/format";
import { KIND_LABEL, KIND_OPTIONS } from "./courses/courseBits";
import { MaterialDialog } from "./courses/MaterialDialog";
import { MaterialsTable } from "./courses/MaterialsTable";
import "./academics.css";

/** Every course's notes, slides, PDFs and links in one place. */
export function MaterialsLibraryPage() {
  const db = useDb();
  const run = useRun();
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState<string>();
  const [kind, setKind] = useState<MaterialKind>();
  const [editing, setEditing] = useState<{ material?: Material } | null>(null);
  const [removing, setRemoving] = useState<Material | null>(null);

  const all = useMemo(() => [...db.materials].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [db.materials]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((m) => (!courseId || m.courseId === courseId) && (!kind || m.kind === kind) && (!s || m.title.toLowerCase().includes(s) || (m.fileName || "").toLowerCase().includes(s)));
  }, [all, q, courseId, kind]);
  const filtered = !!(q.trim() || courseId || kind);
  const hiddenCourses = db.courses.filter((c) => !c.materialsEnabled && db.materials.some((m) => m.courseId === c.id));

  return (
    <AdminPage
      title="Materials library"
      breadcrumb={<Crumbs items={[{ label: "Curriculum" }, { label: "Materials library" }]} />}
      actions={
        <Button icon="plus" onClick={() => setEditing({})} disabled={!db.courses.length} title={db.courses.length ? undefined : "Create a course first"}>
          Add material
        </Button>
      }
    >
      {hiddenCourses.length ? (
        <p className="caption">
          Materials are off for {hiddenCourses.map((c) => c.title).join(", ")}, so students in those batches don't see them. Turn them on in the Course Editor.
        </p>
      ) : null}
      <MaterialsTable
        showCourse
        materials={rows}
        onEdit={(m) => setEditing({ material: m })}
        onRemove={setRemoving}
        toolbar={
          <FilterBar
            searchPlaceholder="Search materials"
            searchValue={q}
            onSearch={setQ}
            filters={[
              { label: "Course", value: getCourse(db, courseId)?.title, options: db.courses.map((c) => ({ value: c.id, label: c.title })), onSelect: setCourseId },
              { label: "Kind", value: kind ? KIND_LABEL[kind] : undefined, options: KIND_OPTIONS, onSelect: (v) => setKind(v as MaterialKind | undefined) },
            ]}
          />
        }
        footer={<span>{`Showing ${rows.length} of ${plural(all.length, "material")}`}</span>}
        empty={
          filtered ? (
            <EmptyState
              icon="search"
              title="No materials match these filters"
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setCourseId(undefined);
                    setKind(undefined);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon="file" title="No materials yet" description="Materials are optional. Add notes, slides, PDFs or links for a course or one of its modules." />
          )
        }
      />
      {editing ? <MaterialDialog open onClose={() => setEditing(null)} material={editing.material} /> : null}
      <ConfirmDialog
        open={!!removing}
        title="Remove material"
        description={removing ? `Remove "${removing.title}" from ${getCourse(db, removing.courseId)?.title}? Students lose access to it straight away.` : ""}
        confirmLabel="Remove material"
        cancelLabel="Keep material"
        onConfirm={() => {
          if (removing) void run(() => removeMaterial(removing.id), "Material removed");
        }}
        onClose={() => setRemoving(null)}
      />
    </AdminPage>
  );
}
