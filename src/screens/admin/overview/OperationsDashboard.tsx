import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useAlerts } from "@/core/alerts";
import { useUser } from "@/auth/AuthContext";
import { ScheduleLectureDialog } from "@/components/ScheduleLectureDialog";
import { BatchChip, LectureChip } from "@/components/StatusChips";
import {
  activeStudentCount,
  joinedCount,
  leadConversion,
  liveLectures,
  monthStartMs,
  newEnrolments,
  nextUpcomingLecture,
  pipelineByStage,
  runningBatches,
  todaysLectures,
} from "@/data/overviewSelectors";
import { getBatch, isEnded, lectureLabel, verifiedAttendanceRate } from "@/data/selectors";
import { useDb } from "@/data/store";
import { Button, Card, Icon, Progress, StatGrid, StatusChip, statusLabel } from "@/design-system";
import { formatNumber, formatRange24, formatTimeRange, formatWhen, plural, seatsLabel } from "@/lib/format";
import { DEFAULT_TZ, tzLabel } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { AdminPage } from "@/layouts/AdminPage";
import { BarList } from "./Charts";
import { AlertList, LinkRow, Stat } from "./parts";

const DAY = 86400000;

/** Super Admin and Operations Manager: what's live, what's today, what needs fixing. */
export function OperationsDashboard() {
  const user = useUser();
  const db = useDb();
  const now = useNow(15000);
  const nav = useNavigate();
  const alerts = useAlerts(user.role, user.id);
  const [scheduling, setScheduling] = useState(false);
  const tz = user.timeZone || DEFAULT_TZ;
  const isAdmin = user.role === "super-admin";

  const d = useMemo(() => {
    const today = todaysLectures(db, now, tz);
    const held = today.filter((l) => l.status !== "cancelled");
    return {
      active: activeStudentCount(db),
      joinedThisMonth: newEnrolments(db, monthStartMs(now, tz), now).length,
      today,
      todayCount: held.length,
      linksMissing: held.filter((l) => !l.linkPublished && !isEnded(l, now)).length,
      attendance: verifiedAttendanceRate(db, now, { sinceMs: now - 30 * DAY }),
      conversion: leadConversion(db, now - 90 * DAY, now),
      live: liveLectures(db, now),
      next: nextUpcomingLecture(db, now),
      batches: runningBatches(db, now).slice(0, 6),
      pipeline: isAdmin ? pipelineByStage(db.leads) : [],
    };
  }, [db, now, tz, isAdmin]);

  return (
    <AdminPage
      title="Dashboard"
      actions={
        <>
          {isAdmin ? (
            <Button variant="secondary" icon="users" onClick={() => nav("/admin/team?invite=1")}>
              Invite member
            </Button>
          ) : null}
          <Button icon="plus" onClick={() => setScheduling(true)}>
            Schedule lecture
          </Button>
        </>
      }
    >
      <StatGrid>
        <Stat title="Active students" value={formatNumber(d.active)} delta={`+${formatNumber(d.joinedThisMonth)} enrolled this month`} tone={d.joinedThisMonth ? "up" : undefined} />
        <Stat
          title="Live today"
          value={formatNumber(d.todayCount)}
          delta={d.todayCount ? (d.linksMissing ? `${plural(d.linksMissing, "link")} not published` : "All links published") : "No lectures today"}
          tone={d.linksMissing ? "warning" : undefined}
        />
        <Stat title="Verified attendance" value={d.attendance.expected ? `${Math.round(d.attendance.pct)}%` : "—"} delta="Last 30 days" />
        <Stat title="Lead → enrolment" value={d.conversion.created ? `${d.conversion.pct.toFixed(1)}%` : "—"} delta={`${d.conversion.enrolled} of ${d.conversion.created} leads · last 90 days`} />
      </StatGrid>

      <div className="split">
        <div className="stack-3">
          <Card title="Live now" description="Join clicks aren't attendance. It's verified after class." flush>
            {d.live.length ? (
              d.live.map((l) => {
                const b = getBatch(db, l.batchId);
                return (
                  <div key={l.id} className="ovw-live">
                    <div className="ovw-live-top">
                      <StatusChip status="live" />
                      <span className="caption">
                        {b?.code} · {lectureLabel(l)}
                      </span>
                    </div>
                    <div className="ovw-live-title">{l.title}</div>
                    <div className="ovw-when">
                      <Icon name="clock" />
                      {formatTimeRange(l.start, l.end, tz)} {tzLabel(tz, new Date(l.start))}
                    </div>
                    {!l.linkPublished ? <div className="text-warning">The meeting link isn't published, so students can't join.</div> : null}
                    <div className="row-between">
                      <span className="muted">{plural(joinedCount(db, l.id), "student")} joined · attendance verified after class</span>
                      <Button variant="secondary" onClick={() => nav(`/admin/lectures/${l.id}`)}>
                        Open lecture
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="ovw-empty">
                No lectures are live right now.
                {d.next ? (
                  <>
                    {" "}
                    Next: {getBatch(db, d.next.batchId)?.code} {lectureLabel(d.next)} · {formatWhen(d.next.start, d.next.end, tz)}
                  </>
                ) : null}
              </div>
            )}
          </Card>

          <Card title="Today" description={`All batches · times in ${tzLabel(tz)}`} flush>
            {d.today.length ? (
              <ul className="list">
                {d.today.map((l) => {
                  const b = getBatch(db, l.batchId);
                  return (
                    <LinkRow key={l.id} to={`/admin/lectures/${l.id}`}>
                      <span className="ovw-time">
                        {formatRange24(l.start, l.end, tz)}
                        <small>{tzLabel(tz, new Date(l.start))}</small>
                      </span>
                      <span className="ovw-grow">
                        <span className="list-title ellipsis" style={{ display: "block" }}>
                          {l.title}
                        </span>
                        <span className="list-sub">
                          {b?.code} · {lectureLabel(l)}
                        </span>
                      </span>
                      <LectureChip lecture={l} now={now} />
                    </LinkRow>
                  );
                })}
              </ul>
            ) : (
              <p className="ovw-empty">No lectures are scheduled for today.</p>
            )}
          </Card>
        </div>

        <div className="stack-3">
          <Card title="Needs attention" flush>
            <AlertList alerts={alerts} />
          </Card>
          <Card title="Batches" description="Ongoing and upcoming" flush actions={<Button variant="ghost" iconRight="chevronRight" onClick={() => nav("/admin/batches")}>All batches</Button>}>
            {d.batches.length ? (
              <ul className="list">
                {d.batches.map(({ batch, filled }) => (
                  <LinkRow key={batch.id} to={`/admin/batches/${batch.id}`}>
                    <span className="ovw-grow">
                      <span className="row-between">
                        <span className="list-title ellipsis">{batch.name}</span>
                        <BatchChip batch={batch} now={now} />
                      </span>
                      <span className="ovw-seats">
                        <Progress value={(filled / batch.capacity) * 100} label={`${batch.code} seats filled`} />
                        <span className="list-sub nowrap">{seatsLabel(filled, batch.capacity)}</span>
                      </span>
                    </span>
                  </LinkRow>
                ))}
              </ul>
            ) : (
              <p className="ovw-empty">No batches are running or open for enrolment.</p>
            )}
          </Card>
        </div>
      </div>

      {isAdmin ? (
        <Card title="Admissions pipeline" description="All leads by current stage, all owners" actions={<Button variant="ghost" iconRight="chevronRight" onClick={() => nav("/admin/leads")}>Open Leads CRM</Button>}>
          <BarList
            label="Leads by stage"
            rows={d.pipeline.map((p) => ({
              key: p.stage,
              label: <StatusChip status={p.stage} />,
              text: statusLabel(p.stage),
              value: p.count,
              display: formatNumber(p.count),
              detail: `${plural(p.count, "lead")} at this stage`,
            }))}
          />
        </Card>
      ) : null}

      <ScheduleLectureDialog open={scheduling} onClose={() => setScheduling(false)} />
    </AdminPage>
  );
}
