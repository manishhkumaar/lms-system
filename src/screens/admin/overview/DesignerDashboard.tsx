import { useMemo } from "react";
import { useNavigate } from "@/lib/router";
import { useAlerts } from "@/core/alerts";
import { useUser } from "@/auth/AuthContext";
import { batchStateIn } from "@/data/selectors";
import { useDb } from "@/data/store";
import { Button, Card, StatGrid, StatusChip } from "@/design-system";
import { formatNumber, formatRelative, plural } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { AdminPage } from "@/layouts/AdminPage";
import { AlertList, LinkRow, Stat } from "./parts";

/** "Yesterday" → "yesterday"; dates ("9 Oct 2026") are left as they are. */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Course Designer: the curriculum at a glance. */
export function DesignerDashboard() {
  const user = useUser();
  const db = useDb();
  const now = useNow(60000);
  const nav = useNavigate();
  const alerts = useAlerts(user.role, user.id);

  const d = useMemo(() => {
    const courses = db.courses
      .map((c) => ({
        course: c,
        templates: c.modules.reduce((n, m) => n + m.lectures.length, 0),
        running: db.batches.filter((b) => b.courseId === c.id && ["ongoing", "upcoming", "full"].includes(batchStateIn(db, b, now))).length,
        materials: db.materials.filter((m) => m.courseId === c.id).length,
      }))
      .sort((a, b) => b.course.updatedAt.localeCompare(a.course.updatedAt));
    const withMaterials = db.courses.filter((c) => c.materialsEnabled).length;
    return {
      courses,
      published: db.courses.filter((c) => c.status === "published").length,
      drafts: db.courses.filter((c) => c.status === "draft").length,
      running: courses.reduce((n, c) => n + c.running, 0),
      materials: db.materials.length,
      withMaterials,
    };
  }, [db, now]);

  return (
    <AdminPage
      title="Dashboard"
      actions={
        <Button icon="plus" onClick={() => nav("/admin/courses")}>
          New course
        </Button>
      }
    >
      <StatGrid>
        <Stat title="Courses" value={formatNumber(d.courses.length)} delta={`${plural(d.running, "batch", "batches")} running or open`} />
        <Stat title="Published" value={formatNumber(d.published)} delta="Available for new batches" />
        <Stat title="Drafts" value={formatNumber(d.drafts)} delta={d.drafts ? "Not available for batches yet" : "Nothing in draft"} tone={d.drafts ? "warning" : undefined} />
        <Stat title="Materials" value={formatNumber(d.materials)} delta={`${plural(d.withMaterials, "course")} with materials on`} />
      </StatGrid>

      <div className="split">
        <Card
          title="Courses"
          description="Most recently updated first"
          flush
          actions={
            <Button variant="ghost" iconRight="chevronRight" onClick={() => nav("/admin/courses")}>
              All courses
            </Button>
          }
        >
          <ul className="list">
            {d.courses.map(({ course, templates, running, materials }) => (
              <LinkRow key={course.id} to={`/admin/courses/${course.id}`}>
                <span className="ovw-grow">
                  <span className="list-title ellipsis" style={{ display: "block" }}>
                    {course.title}
                  </span>
                  <span className="list-sub">
                    <span className="bl-mono">{course.code}</span> · {plural(course.modules.length, "module")} · {plural(templates, "lecture template")} · {plural(materials, "material")} · {plural(running, "batch", "batches")} · Updated {lowerFirst(formatRelative(course.updatedAt, now))}
                  </span>
                </span>
                <span className="row" style={{ flex: "none" }}>
                  <StatusChip status={course.materialsEnabled ? "materials-on" : "materials-off"} />
                  {course.status === "published" ? (
                    <StatusChip status="published" tone="success">
                      Published
                    </StatusChip>
                  ) : (
                    <StatusChip status="draft" />
                  )}
                </span>
              </LinkRow>
            ))}
          </ul>
        </Card>
        <Card title="Drafts to finish" flush>
          <AlertList alerts={alerts} empty="Every course is published." />
        </Card>
      </div>
    </AdminPage>
  );
}
