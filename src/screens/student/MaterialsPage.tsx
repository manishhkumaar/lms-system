"use client";
import { useMemo } from "react";
import { materialsForBatches } from "@/data/studentSelectors";
import { Card, EmptyState } from "@/design-system";
import { StudentPage } from "@/layouts/StudentLayout";
import { MaterialItem } from "./parts/Items";
import { useMe } from "./parts/useMe";
import "./student.css";

export function MaterialsPage() {
  const { db, batchIds, tz } = useMe();
  // Courses with materials switched off are left out entirely.
  const groups = useMemo(() => materialsForBatches(db, batchIds), [db, batchIds]);

  return (
    <StudentPage title="Materials" subtitle="Notes, slides and links shared by your course designers.">
      {groups.length ? (
        groups.map(({ course, materials }) => (
          <Card key={course.id} title={course.title} flush>
            {materials.length ? (
              <ul className="list">
                {materials.map((m) => (
                  <li key={m.id}>
                    <MaterialItem material={m} moduleTitle={course.modules.find((x) => x.id === m.moduleId)?.title} tz={tz} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="file" title="No materials yet" description="Materials for this course appear here once they're added." />
            )}
          </Card>
        ))
      ) : (
        <Card>
          <EmptyState icon="file" title="Your courses don't have materials" description="Everything you need is covered in the live classes and their recordings." />
        </Card>
      )}
    </StudentPage>
  );
}
