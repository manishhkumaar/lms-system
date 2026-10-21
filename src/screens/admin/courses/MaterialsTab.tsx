import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRun } from "@/components/useRun";
import { removeMaterial, setMaterialsEnabled } from "@/data/actions";
import { useDb } from "@/data/store";
import type { Course, Material } from "@/data/types";
import { Banner, Button, Card, EmptyState, Toggle } from "@/design-system";
import { MaterialDialog } from "./MaterialDialog";
import { MaterialsTable } from "./MaterialsTable";

export function MaterialsTab({ course }: { course: Course }) {
  const db = useDb();
  const run = useRun();
  const [editing, setEditing] = useState<{ material?: Material } | null>(null);
  const [removing, setRemoving] = useState<Material | null>(null);
  const materials = useMemo(() => db.materials.filter((m) => m.courseId === course.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [db.materials, course.id]);

  return (
    <div className="stack-3">
      <Card>
        <div className="stack">
          <Toggle
            label="Learning materials"
            description="Show notes, slides and files to students in this course"
            checked={course.materialsEnabled}
            onChange={(on) => void run(() => setMaterialsEnabled(course.id, on), on ? "Materials turned on" : "Materials turned off", on ? "Students in this course's batches can see them now." : "The Materials tab is hidden for these students.")}
          />
          {course.materialsEnabled ? (
            <p className="caption">Students see these in their Materials tab and alongside each module.</p>
          ) : (
            <Banner tone="neutral" title="Materials are off">
              Students in this course's batches don't see a Materials tab at all. What you add here is kept and appears when you turn materials back on.
            </Banner>
          )}
        </div>
      </Card>

      <Card
        flush
        title="Materials"
        description={`${materials.length} for this course`}
        actions={
          <Button variant="secondary" icon="plus" onClick={() => setEditing({})}>
            Add material
          </Button>
        }
      >
        <MaterialsTable
          materials={materials}
          onEdit={(m) => setEditing({ material: m })}
          onRemove={setRemoving}
          empty={<EmptyState icon="file" title="No materials yet" description="Add notes, slides, PDFs or links. They're optional for every course." />}
        />
      </Card>

      {editing ? <MaterialDialog open onClose={() => setEditing(null)} courseId={course.id} material={editing.material} /> : null}
      <ConfirmDialog
        open={!!removing}
        title="Remove material"
        description={removing ? `Remove "${removing.title}" from ${course.title}? Students lose access to it straight away.` : ""}
        confirmLabel="Remove material"
        cancelLabel="Keep material"
        onConfirm={() => {
          if (removing) void run(() => removeMaterial(removing.id), "Material removed");
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
