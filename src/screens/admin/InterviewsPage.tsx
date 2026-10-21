"use client";
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useUser } from "@/auth/AuthContext";
import { useDb } from "@/data/store";
import { getCourse, getUser } from "@/data/selectors";
import type { Lead } from "@/data/types";
import { Button, Card, EmptyState, SegmentedControl, StatusChip } from "@/design-system";
import { formatRange24, formatRelative, formatWeekdayDate } from "@/lib/format";
import { addDays, dateKey, DEFAULT_TZ, tzLabel } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { AdminPage, Crumbs } from "@/layouts/AdminPage";
import { INTERVIEW_MINS, shortCourse } from "./leads/leadUtils";
import { useLeadStageMover } from "./leads/StageDialogs";
import "./admissions.css";

type Scope = "mine" | "all";

const slotEnd = (iso: string) => new Date(new Date(iso).getTime() + INTERVIEW_MINS * 60000);

/** "11:00–11:30 IST" */
function slot(iso: string) {
  return `${formatRange24(iso, slotEnd(iso), DEFAULT_TZ)} ${tzLabel(DEFAULT_TZ, new Date(iso))}`;
}

function LeadLine({ lead }: { lead: Lead }) {
  const db = useDb();
  return (
    <div className="adm-grow">
      <Link to={`/admin/leads?lead=${lead.id}`} className="list-title" style={{ textDecoration: "none", color: "var(--ink)" }}>
        {lead.name}
      </Link>
      <div className="list-sub">
        {shortCourse(getCourse(db, lead.courseId)?.title)} · {lead.phone} · {getUser(db, lead.ownerId)?.name || "Unassigned"}
      </div>
    </div>
  );
}

/** Admissions interviews: what's booked, and what needs an outcome. */
export function InterviewsPage() {
  const db = useDb();
  const user = useUser();
  const now = useNow(30000);
  const mover = useLeadStageMover();
  const [scope, setScope] = useState<Scope>(user.role === "admissions" ? "mine" : "all");

  const { upcomingDays, awaiting, decision } = useMemo(() => {
    const mine = (l: Lead) => scope === "all" || l.ownerId === user.id;
    const scheduled = db.leads.filter((l) => l.stage === "interview-scheduled" && l.interviewAt && mine(l)).sort((a, b) => a.interviewAt!.localeCompare(b.interviewAt!));
    const upcoming = scheduled.filter((l) => slotEnd(l.interviewAt!).getTime() > now);
    const days = new Map<string, Lead[]>();
    for (const l of upcoming) {
      const k = dateKey(l.interviewAt!, DEFAULT_TZ);
      days.set(k, [...(days.get(k) || []), l]);
    }
    return {
      upcomingDays: [...days.entries()],
      awaiting: scheduled.filter((l) => slotEnd(l.interviewAt!).getTime() <= now).reverse(),
      decision: db.leads.filter((l) => l.stage === "interviewed" && mine(l)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    };
  }, [db.leads, scope, user.id, now]);

  const today = dateKey(new Date(now), DEFAULT_TZ);
  const dayLabel = (k: string) => (k === today ? "Today" : k === addDays(today, 1) ? "Tomorrow" : "");
  const upcomingCount = upcomingDays.reduce((n, [, ls]) => n + ls.length, 0);

  return (
    <AdminPage
      title="Interviews"
      breadcrumb={<Crumbs items={[{ label: "Admissions" }, { label: "Interviews" }]} />}
      actions={
        <Button icon="calendar" onClick={() => mover.scheduleInterview()}>
          Schedule interview
        </Button>
      }
    >
      <div className="row-between">
        <p className="muted">
          Interviews are 30-minute slots. Times are in {tzLabel(DEFAULT_TZ)}.
        </p>
        <SegmentedControl<Scope>
          label="Whose interviews"
          value={scope}
          onChange={setScope}
          options={[
            { value: "mine", label: "Mine" },
            { value: "all", label: "Everyone" },
          ]}
        />
      </div>

      {awaiting.length ? (
        <Card title="Awaiting outcome" description="The interview time has passed. Record what happened so the lead moves on." flush>
          <ul className="list">
            {awaiting.map((l) => (
              <li key={l.id} className="adm-wrap">
                <span className="adm-time">{formatWeekdayDate(l.interviewAt!, DEFAULT_TZ).replace(",", "")}</span>
                <LeadLine lead={l} />
                <div className="adm-actions">
                  <Button variant="secondary" onClick={() => mover.move(l.id, "interviewed")}>
                    Move to Interviewed
                  </Button>
                  <Button variant="secondary" onClick={() => mover.move(l.id, "selected")}>
                    Select
                  </Button>
                  <Button variant="ghost" onClick={() => mover.move(l.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Upcoming" description={upcomingCount ? `${upcomingCount} booked` : undefined} flush>
        {upcomingDays.length ? (
          upcomingDays.map(([day, leads]) => (
            <div key={day}>
              <div className="adm-day">
                {dayLabel(day) || formatWeekdayDate(day)}
                {dayLabel(day) ? <span>{formatWeekdayDate(day)}</span> : null}
              </div>
              <ul className="list">
                {leads.map((l) => {
                  const inProgress = new Date(l.interviewAt!).getTime() <= now;
                  return (
                    <li key={l.id} className="adm-wrap">
                      <span className="adm-time">{slot(l.interviewAt!)}</span>
                      <LeadLine lead={l} />
                      <div className="adm-actions">
                        {inProgress ? <StatusChip status="live">In progress</StatusChip> : null}
                        <Button variant="secondary" onClick={() => mover.scheduleInterview(l.id)}>
                          Reschedule
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <EmptyState
            icon="calendar"
            title={scope === "mine" ? "You have no interviews booked" : "No interviews booked"}
            description="Schedule one for a lead in New or Contacted. It shows here and on the lead's card."
            action={
              <Button variant="secondary" icon="calendar" onClick={() => mover.scheduleInterview()}>
                Schedule interview
              </Button>
            }
          />
        )}
      </Card>

      <Card title="Interviewed, awaiting decision" description="Select to make an offer, or reject with a reason." flush>
        {decision.length ? (
          <ul className="list">
            {decision.map((l) => (
              <li key={l.id} className="adm-wrap">
                <span className="adm-time">{l.interviewAt ? formatWeekdayDate(l.interviewAt, DEFAULT_TZ).replace(",", "") : "—"}</span>
                <LeadLine lead={l} />
                <span className="caption nowrap">Updated {formatRelative(l.updatedAt, now).replace(/^[A-Z]/, (c) => c.toLowerCase())}</span>
                <div className="adm-actions">
                  <Button variant="secondary" onClick={() => mover.move(l.id, "selected")}>
                    Select
                  </Button>
                  <Button variant="ghost" onClick={() => mover.move(l.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="checklist" title="No decisions pending" description="Leads move here after their interview." />
        )}
      </Card>

      {mover.dialogs}
    </AdminPage>
  );
}
