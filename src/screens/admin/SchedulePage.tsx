"use client";
import "./delivery.css";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "@/lib/router";
import { useUser } from "@/auth/AuthContext";
import { ScheduleLectureDialog } from "@/components/ScheduleLectureDialog";
import { LectureChip } from "@/components/StatusChips";
import { useDb } from "@/data/store";
import { getBatch, lectureStateIn } from "@/data/selectors";
import { Button, EmptyState, FilterBar, WeekCalendar, type CalendarEvent } from "@/design-system";
import { formatTimeRange, formatWeekdayDate, plural } from "@/lib/format";
import { addDays, dateKey, startOfWeek, timeKey } from "@/lib/time";
import { useIsMobile } from "@/lib/useMediaQuery";
import { useNow } from "@/lib/useNow";
import { AdminPage } from "@/layouts/AdminPage";
import { lectureRef, navBreadcrumb, useViewerZone, weekRangeLabel } from "./delivery/shared";

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Schedule Calendar: lectures across all batches for one week, in the viewer's zone. */
export function SchedulePage() {
  const db = useDb();
  const user = useUser();
  const now = useNow(15000);
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const { tz, label } = useViewerZone();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const today = dateKey(new Date(now), tz);
  const thisWeek = startOfWeek(today);
  const weekParam = params.get("week");
  const weekStart = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? startOfWeek(weekParam) : thisWeek;
  const batchId = params.get("batch") || undefined;
  const batch = getBatch(db, batchId);

  const setParam = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];

  const lectures = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.lectures
      .filter((l) => {
        const d = dateKey(l.start, tz);
        if (d < weekStart || d > weekEnd) return false;
        if (batchId && l.batchId !== batchId) return false;
        if (s) {
          const b = getBatch(db, l.batchId);
          if (![l.title, b?.code, b?.name].some((x) => x?.toLowerCase().includes(s))) return false;
        }
        return true;
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [db, tz, weekStart, weekEnd, batchId, q]);

  const events = useMemo(
    () =>
      lectures.map((l) => {
        const start = timeKey(l.start, tz);
        let end = timeKey(l.end, tz);
        if (end <= start) end = "23:59";
        return {
          id: l.id,
          day: days.indexOf(dateKey(l.start, tz)),
          start,
          end,
          title: l.title,
          batch: lectureRef(db, l),
          status: lectureStateIn(db, l, now),
        } satisfies CalendarEvent;
      }),
    [lectures, db, tz, days, now],
  );

  // Default 07:00–22:00, stretched to fit any lecture outside it.
  let startHour = 7;
  let endHour = 22;
  for (const e of events) {
    startHour = Math.min(startHour, Math.floor(mins(e.start) / 60));
    endHour = Math.max(endHour, Math.ceil(mins(e.end) / 60));
  }
  endHour = Math.min(24, endHour);

  const counts = useMemo(() => {
    let total = 0;
    let noLink = 0;
    let live = 0;
    for (const e of events) {
      if (e.status !== "cancelled") total++;
      if (e.status === "link-missing") noLink++;
      if (e.status === "live") live++;
    }
    return { total, noLink, live };
  }, [events]);

  const batchOptions = useMemo(() => db.batches.filter((b) => b.lifecycle !== "draft").map((b) => ({ value: b.id, label: b.code })), [db.batches]);
  const todayIndex = days.indexOf(today);
  const filtered = !!batchId || !!q.trim();

  const legend = (
    <div className="dlv-legend" aria-label="Legend">
      <span className="dlv-legend-item">
        <span className="dlv-swatch scheduled" aria-hidden="true" />
        Scheduled
      </span>
      <span className="dlv-legend-item">
        <span className="dlv-swatch live" aria-hidden="true" />
        Live now (marked LIVE)
      </span>
      <span className="dlv-legend-item">
        <span className="dlv-swatch nolink" aria-hidden="true" />
        Link not published (marked no link)
      </span>
      <span className="dlv-legend-item">
        <span className="dlv-swatch done" aria-hidden="true" />
        Finished
      </span>
      <span className="dlv-legend-item">
        <span className="dlv-swatch cancelled" aria-hidden="true" />
        Cancelled
      </span>
      <span className="dlv-legend-item">All times in {label}</span>
    </div>
  );

  let body;
  if (!events.length) {
    body = (
      <div className="bl-card">
        {filtered ? (
          <EmptyState
            icon="filter"
            title="No lectures match these filters"
            description={`Nothing ${batch ? `for ${batch.code} ` : ""}in the week of ${weekRangeLabel(weekStart, weekEnd)}.`}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQ("");
                  setParam("batch", undefined);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="calendar"
            title="No lectures this week"
            description="Lectures you schedule for any batch appear here, with their meeting link status."
            action={
              <Button variant="secondary" icon="plus" onClick={() => setOpen(true)}>
                Schedule lecture
              </Button>
            }
          />
        )}
      </div>
    );
  } else if (isMobile) {
    const groups = days.map((d) => ({ d, items: lectures.filter((l) => dateKey(l.start, tz) === d) })).filter((g) => g.items.length);
    body = (
      <div className="dlv-agenda">
        {groups.map((g) => (
          <section key={g.d} className="dlv-agenda-day" aria-label={formatWeekdayDate(g.d)}>
            <h3>
              {formatWeekdayDate(g.d)}
              {g.d === today ? <span className="today"> · Today</span> : null}
            </h3>
            <div className="bl-card">
              {g.items.map((l) => (
                <Link key={l.id} to={`/admin/lectures/${l.id}`} className="dlv-agenda-item">
                  <span className="row-between">
                    <span className="dlv-agenda-time">
                      {formatTimeRange(l.start, l.end, tz)} {label}
                    </span>
                    <LectureChip lecture={l} now={now} />
                  </span>
                  <span className="dlv-agenda-title">{l.title}</span>
                  <span className="caption">{lectureRef(db, l)}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  } else {
    body = (
      <WeekCalendar
        days={days.map((d, i) => ({ label: WEEKDAY[i], date: String(Number(d.slice(8, 10))) }))}
        events={events}
        startHour={startHour}
        endHour={endHour}
        tzLabel={label}
        todayIndex={todayIndex >= 0 ? todayIndex : undefined}
        onEventClick={(e) => nav(`/admin/lectures/${e.id}`)}
      />
    );
  }

  return (
    <AdminPage
      title="Schedule"
      breadcrumb={navBreadcrumb(user.role, "schedule", "Schedule")}
      actions={
        <Button icon="plus" onClick={() => setOpen(true)}>
          Schedule lecture
        </Button>
      }
    >
      <div className="dlv-weekbar">
        <div className="dlv-weeknav">
          <Button variant="secondary" icon="chevronLeft" aria-label="Previous week" onClick={() => setParam("week", addDays(weekStart, -7))} />
          <Button variant="secondary" icon="chevronRight" aria-label="Next week" onClick={() => setParam("week", addDays(weekStart, 7))} />
          <h2 className="dlv-range" aria-live="polite">
            {weekRangeLabel(weekStart, weekEnd)}
          </h2>
          {weekStart !== thisWeek ? (
            <Button variant="ghost" icon="calendar" onClick={() => setParam("week", undefined)}>
              This week
            </Button>
          ) : null}
        </div>
        <div className="dlv-summary" aria-label={weekStart === thisWeek ? "This week" : "Selected week"}>
          <span>
            <strong>{counts.total}</strong> {counts.total === 1 ? "lecture" : "lectures"}
          </span>
          <span className={counts.noLink ? "warn" : undefined}>
            <strong>{counts.noLink}</strong> {counts.noLink === 1 ? "link" : "links"} not published
          </span>
          <span className={counts.live ? "live" : undefined}>
            <strong>{counts.live}</strong> live now
          </span>
        </div>
      </div>

      <div className="bl-card">
        <FilterBar
          searchPlaceholder="Search lectures or batches"
          searchValue={q}
          onSearch={setQ}
          filters={[{ label: "Batch", value: batch?.code, options: batchOptions, onSelect: (v) => setParam("batch", v) }]}
        />
      </div>

      {legend}
      {body}
      {events.length && isMobile ? <p className="caption">{plural(counts.total, "lecture")} this week. Times shown in {label}.</p> : null}

      <ScheduleLectureDialog open={open} onClose={() => setOpen(false)} batchId={batchId} />
    </AdminPage>
  );
}
