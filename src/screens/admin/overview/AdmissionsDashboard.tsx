import { useMemo } from "react";
import { useNavigate } from "@/lib/router";
import { useUser } from "@/auth/AuthContext";
import { leadEnrolledAt, monthStartMs, pipelineByStage, previousMonthStartMs, weekRangeMs } from "@/data/overviewSelectors";
import { followUpDue, followUpOverdue, getCourse, isLeadOpen } from "@/data/selectors";
import { useDb } from "@/data/store";
import { Button, Card, Icon, StatGrid, StatusChip, statusLabel } from "@/design-system";
import { formatDayMonth, formatNumber, formatTime24, plural } from "@/lib/format";
import { dateKey, DEFAULT_TZ, tzLabel } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { AdminPage } from "@/layouts/AdminPage";
import { BarList } from "./Charts";
import { LinkRow, Stat } from "./parts";

/** Admissions Executive: my follow-ups, today's interviews and the pipeline. */
export function AdmissionsDashboard() {
  const user = useUser();
  const db = useDb();
  const now = useNow(30000);
  const nav = useNavigate();
  const tz = user.timeZone || DEFAULT_TZ;

  const d = useMemo(() => {
    const mine = db.leads.filter((l) => l.ownerId === user.id);
    const open = mine.filter(isLeadOpen);
    const [weekStart, weekEnd] = weekRangeMs(now, tz);
    const today = dateKey(new Date(now), tz);
    const due = mine
      .filter((l) => followUpDue(l, now, tz))
      .sort((a, b) => (a.followUpOn || "").localeCompare(b.followUpOn || "") || a.name.localeCompare(b.name));
    const interviewsWeek = mine.filter((l) => l.interviewAt && Date.parse(l.interviewAt) >= weekStart && Date.parse(l.interviewAt) < weekEnd);
    const interviewsToday = mine
      .filter((l) => l.interviewAt && dateKey(l.interviewAt, tz) === today && l.stage === "interview-scheduled")
      .sort((a, b) => (a.interviewAt || "").localeCompare(b.interviewAt || ""));
    const monthStart = monthStartMs(now, tz);
    const prevStart = previousMonthStartMs(now, tz);
    const enrolledAt = mine.filter((l) => l.stage === "enrolled").map(leadEnrolledAt);
    return {
      open: open.length,
      newThisWeek: open.filter((l) => Date.parse(l.createdAt) >= weekStart).length,
      due,
      overdue: due.filter((l) => followUpOverdue(l, now, tz)).length,
      interviewsWeek: interviewsWeek.length,
      interviewsTodayCount: interviewsWeek.filter((l) => dateKey(l.interviewAt!, tz) === today).length,
      interviewsToday,
      enrolledThisMonth: enrolledAt.filter((t) => t !== undefined && t >= monthStart).length,
      enrolledLastMonth: enrolledAt.filter((t) => t !== undefined && t >= prevStart && t < monthStart).length,
      pipeline: pipelineByStage(db.leads),
      today,
    };
  }, [db, now, tz, user.id]);

  const enrolTrend = d.enrolledThisMonth > d.enrolledLastMonth ? "up" : d.enrolledThisMonth < d.enrolledLastMonth ? "down" : undefined;

  return (
    <AdminPage
      title="Dashboard"
      actions={
        <Button icon="plus" onClick={() => nav("/admin/leads?new=1")}>
          Add lead
        </Button>
      }
    >
      <StatGrid>
        <Stat title="My open leads" value={formatNumber(d.open)} delta={`+${formatNumber(d.newThisWeek)} new this week`} tone={d.newThisWeek ? "up" : undefined} />
        <Stat title="Follow-ups due" value={formatNumber(d.due.length)} delta={d.overdue ? `${formatNumber(d.overdue)} overdue` : "None overdue"} tone={d.overdue ? "warning" : undefined} />
        <Stat title="Interviews this week" value={formatNumber(d.interviewsWeek)} delta={`${formatNumber(d.interviewsTodayCount)} today`} />
        <Stat title="Enrolled this month" value={formatNumber(d.enrolledThisMonth)} delta={`vs ${formatNumber(d.enrolledLastMonth)} last month`} tone={enrolTrend} />
      </StatGrid>

      <div className="split">
        <Card title="Follow-ups due" description="Your leads, overdue first" flush>
          {d.due.length ? (
            <ul className="list">
              {d.due.map((l) => {
                const overdue = (l.followUpOn || "") < d.today;
                return (
                  <LinkRow key={l.id} to={`/admin/leads?lead=${l.id}`}>
                    <span className="ovw-grow">
                      <span className="list-title ellipsis" style={{ display: "block" }}>
                        {l.name}
                      </span>
                      <span className="list-sub">
                        {getCourse(db, l.courseId)?.title} · {l.phone}
                      </span>
                    </span>
                    <span className={overdue ? "text-warning nowrap" : "muted nowrap"} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                      <Icon name="clock" />
                      {overdue ? `Overdue since ${formatDayMonth(l.followUpOn!)}` : "Due today"}
                    </span>
                    <StatusChip status={l.stage} />
                  </LinkRow>
                );
              })}
            </ul>
          ) : (
            <p className="ovw-empty">No follow-ups are due. New ones appear here on the day they're due.</p>
          )}
        </Card>

        <Card title="Today's interviews" description={`Times in ${tzLabel(tz)}`} flush>
          {d.interviewsToday.length ? (
            <ul className="list">
              {d.interviewsToday.map((l) => (
                <LinkRow key={l.id} to={`/admin/leads?lead=${l.id}`}>
                  <span className="ovw-time" style={{ width: 64 }}>
                    {formatTime24(l.interviewAt!, tz)}
                    <small>{tzLabel(tz, new Date(l.interviewAt!))}</small>
                  </span>
                  <span className="ovw-grow">
                    <span className="list-title ellipsis" style={{ display: "block" }}>
                      {l.name}
                    </span>
                    <span className="list-sub">{getCourse(db, l.courseId)?.title}</span>
                  </span>
                </LinkRow>
              ))}
            </ul>
          ) : (
            <p className="ovw-empty">No interviews today.</p>
          )}
        </Card>
      </div>

      <Card
        title="Pipeline"
        description={`All leads by current stage, all owners · ${plural(db.leads.length, "lead")}`}
        actions={
          <Button variant="ghost" iconRight="chevronRight" onClick={() => nav("/admin/leads")}>
            Open Leads CRM
          </Button>
        }
      >
        <BarList
          label="Leads by stage"
          rows={d.pipeline.map((p) => ({
            key: p.stage,
            label: <StatusChip status={p.stage} />,
            text: statusLabel(p.stage),
            value: p.count,
            display: formatNumber(p.count),
            detail: `${plural(p.count, "lead")} at this stage${p.stage === "new" ? ` · ${db.leads.filter((l) => l.stage === "new" && !l.ownerId).length} without an owner` : ""}`,
          }))}
        />
      </Card>
    </AdminPage>
  );
}
