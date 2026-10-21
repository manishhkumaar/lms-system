"use client";
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { recordingsForBatches } from "@/data/studentSelectors";
import { Card, EmptyState, Icon } from "@/design-system";
import { plural } from "@/lib/format";
import { StudentPage } from "@/layouts/StudentLayout";
import { RecordingItem } from "./parts/Items";
import { useMe } from "./parts/useMe";
import "./student.css";

export function RecordingsLibraryPage() {
  const { db, batches, batchIds, tz } = useMe();
  const [q, setQ] = useState("");
  const all = useMemo(() => recordingsForBatches(db, batchIds), [db, batchIds]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? all.filter((r) => r.recording.title.toLowerCase().includes(s) || `lecture ${r.lecture.number}`.includes(s)) : all;
  }, [all, q]);

  const empty = (
    <Card>
      <EmptyState
        icon="video"
        title="No recordings yet"
        description="Recordings appear here after each lecture once Operations uploads them."
        action={
          <Link to="/learn/timeline" className="bl-btn bl-btn-secondary bl-btn-touch stu-action">
            <Icon name="calendar" />
            View lecture timeline
          </Link>
        }
      />
    </Card>
  );

  return (
    <StudentPage title="Recordings" subtitle={all.length ? `${plural(all.length, "recording")} from your batches` : undefined}>
      {!all.length ? (
        empty
      ) : (
        <>
          <div className="bl-search" style={{ marginLeft: 0, width: "100%", maxWidth: 420 }}>
            <Icon name="search" />
            <input className="bl-input" placeholder="Search recordings" aria-label="Search recordings" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {batches.map((b) => {
            const items = shown.filter((r) => r.batch.id === b.id);
            if (!items.length) return null;
            return (
              <Card key={b.id} title={b.name} description={plural(items.length, "recording")} flush>
                <ul className="list">
                  {items.map((r) => (
                    <li key={r.recording.id}>
                      <RecordingItem recording={r.recording} lecture={r.lecture} batch={r.batch} tz={tz} />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          {!shown.length ? (
            <Card>
              <EmptyState icon="search" title={`No recordings match "${q.trim()}"`} description="Try a different word from the lecture title." />
            </Card>
          ) : null}
        </>
      )}
    </StudentPage>
  );
}
