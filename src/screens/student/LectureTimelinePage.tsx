"use client";
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { isEnded, isLive } from "@/data/selectors";
import { lecturesForBatches } from "@/data/studentSelectors";
import type { Lecture } from "@/data/types";
import { Button, Card, EmptyState, SegmentedControl } from "@/design-system";
import { tzLabel } from "@/lib/time";
import { StudentPage } from "@/layouts/StudentLayout";
import { LectureRow } from "./parts/Items";
import { useMe } from "./parts/useMe";
import "./student.css";

const FORTNIGHT = 14 * 86400000;
const PAST_STEP = 10;

export function LectureTimelinePage() {
  const { db, now, batches, batchIds, tz } = useMe();
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [allUpcoming, setAllUpcoming] = useState(false);
  const [pastShown, setPastShown] = useState(PAST_STEP);

  const lectures = useMemo(() => lecturesForBatches(db, batchFilter === "all" ? batchIds : [batchFilter]), [db, batchIds, batchFilter]);
  const live = lectures.filter((l) => isLive(l, now));
  const upcomingAll = lectures.filter((l) => new Date(l.start).getTime() > now);
  const upcoming = allUpcoming ? upcomingAll : upcomingAll.filter((l) => new Date(l.start).getTime() - now < FORTNIGHT);
  const past = lectures.filter((l) => isEnded(l, now) || (l.status === "cancelled" && new Date(l.start).getTime() <= now)).reverse();
  const firstUpcomingId = upcomingAll.find((l) => l.status !== "cancelled")?.id;
  const showBatch = batchFilter === "all" && batches.length > 1;

  const item = (l: Lecture, cls: string) => (
    <li key={l.id} className={cls}>
      <LectureRow db={db} lecture={l} now={now} tz={tz} showBatch={showBatch} />
    </li>
  );

  return (
    <StudentPage title="Lecture timeline" subtitle={`Every class, past and upcoming. Times are shown in ${tzLabel(tz)}.`}>
      {batches.length > 1 ? (
        <SegmentedControl
          label="Batch"
          value={batchFilter}
          onChange={(v) => {
            setBatchFilter(v);
            setPastShown(PAST_STEP);
          }}
          options={[{ value: "all", label: "All batches" }, ...batches.map((b) => ({ value: b.id, label: b.code }))]}
        />
      ) : null}

      {!lectures.length ? (
        <Card>
          <EmptyState icon="calendar" title="No lectures yet" description="Your lectures appear here once Operations schedules them for your batch." />
        </Card>
      ) : (
        <>
          {live.length ? (
            <Card flush>
              <div className="stu-timeline">
                <h2 className="stu-section-title">Live now</h2>
                <ul className="timeline">{live.map((l) => item(l, "live"))}</ul>
              </div>
            </Card>
          ) : null}

          <Card flush>
            <div className="stu-timeline">
              <h2 className="stu-section-title">{allUpcoming ? "Upcoming" : "Upcoming · next 14 days"}</h2>
              {upcoming.length ? (
                <ul className="timeline">{upcoming.map((l) => item(l, l.id === firstUpcomingId ? "next" : ""))}</ul>
              ) : (
                <p className="muted" style={{ paddingBottom: "var(--space-2)" }}>
                  {upcomingAll.length ? "No classes in the next 14 days." : "No upcoming classes. Recordings of past lectures stay available."}
                </p>
              )}
              {!allUpcoming && upcomingAll.length > upcoming.length ? (
                <div style={{ paddingBottom: "var(--space-2)" }}>
                  <Button variant="secondary" touch onClick={() => setAllUpcoming(true)}>
                    Show all {upcomingAll.length} upcoming
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>

          {past.length ? (
            <Card flush>
              <div className="stu-timeline">
                <h2 className="stu-section-title">Past</h2>
                <ul className="timeline">{past.slice(0, pastShown).map((l) => item(l, l.status === "cancelled" ? "" : "done"))}</ul>
                {past.length > pastShown ? (
                  <div style={{ paddingBottom: "var(--space-2)" }}>
                    <Button variant="secondary" touch onClick={() => setPastShown((n) => n + PAST_STEP)}>
                      Show earlier lectures
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <p className="caption">
            Looking for a recording? <Link to="/learn/recordings">Open the recordings library</Link>.
          </p>
        </>
      )}
    </StudentPage>
  );
}
