import type { ReactNode } from "react";
import { useDb } from "@/data/store";
import { getCourse } from "@/data/selectors";
import type { Material } from "@/data/types";
import { Button, DataTable, Icon, Menu, NameCell, type Column } from "@/design-system";
import { formatDate } from "@/lib/format";
import { KIND_ICON, KIND_LABEL, MaterialsChip } from "./courseBits";
import { sizeLabel } from "./MaterialDialog";

function detail(m: Material) {
  if (m.kind === "link" && m.url) {
    try {
      return new URL(m.url).hostname;
    } catch {
      return m.url;
    }
  }
  if (m.fileName) return `${m.fileName} · ${sizeLabel(m.sizeKb)}`;
  if (m.kind === "notes" && m.body) return `${m.body.split(/\s+/).length} words`;
  return "";
}

export interface MaterialsTableProps {
  materials: Material[];
  showCourse?: boolean;
  toolbar?: ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
  onEdit: (m: Material) => void;
  onRemove: (m: Material) => void;
}

export function MaterialsTable({ materials, showCourse, toolbar, footer, empty, onEdit, onRemove }: MaterialsTableProps) {
  const db = useDb();
  const columns: Column<Material>[] = [
    {
      key: "title",
      label: "Material",
      render: (m) => (
        <span style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span className="subtle" style={{ marginTop: 2 }}>
            <Icon name={KIND_ICON[m.kind]} />
          </span>
          <NameCell name={m.title} sub={[KIND_LABEL[m.kind], detail(m)].filter(Boolean).join(" · ")} />
        </span>
      ),
    },
    ...(showCourse ? [{ key: "course", label: "Course", render: (m: Material) => getCourse(db, m.courseId)?.title || "—" }] : []),
    {
      key: "module",
      label: "Module",
      render: (m) => getCourse(db, m.courseId)?.modules.find((x) => x.id === m.moduleId)?.title || "Whole course",
    },
    { key: "updated", label: "Updated", render: (m) => <span className="nowrap">{formatDate(m.updatedAt)}</span> },
    ...(showCourse ? [{ key: "visible", label: "Students see", render: (m: Material) => <MaterialsChip on={!!getCourse(db, m.courseId)?.materialsEnabled} /> }] : []),
    {
      key: "actions",
      label: <span className="visually-hidden">Actions</span>,
      width: 56,
      render: (m) => (
        <span className="acd-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Menu
            align="end"
            items={[
              { label: "Edit material", icon: "edit", onClick: () => onEdit(m) },
              ...(m.kind === "link" && m.url ? [{ label: "Open link", icon: "external" as const, onClick: () => window.open(m.url, "_blank", "noopener") }] : []),
              "separator",
              { label: "Remove material", icon: "trash", danger: true, onClick: () => onRemove(m) },
            ]}
            trigger={(p) => <Button variant="ghost" icon="more" className="acd-icon-btn" aria-label={`Actions for ${m.title}`} {...p} />}
          />
        </span>
      ),
    },
  ];
  return <DataTable columns={columns} rows={materials} toolbar={toolbar} footer={footer} empty={empty} onRowClick={onEdit} />;
}
