import { cx } from "../utils";
import type { Status } from "./StatusChip";

export interface CalendarEvent {
  id?: string;
  /** Index into days. */
  day: number;
  /** "HH:MM" in the calendar's zone. */
  start: string;
  end: string;
  title: string;
  batch?: string;
  status?: Status;
}

export interface WeekCalendarProps<E extends CalendarEvent = CalendarEvent> {
  days: Array<{ label: string; date: string }>;
  events: E[];
  startHour?: number;
  endHour?: number;
  /** Shown in the corner, e.g. IST. */
  tzLabel?: string;
  todayIndex?: number;
  onEventClick?: (e: E) => void;
}

function mins(t: string) {
  const p = t.split(":");
  return +p[0] * 60 + +p[1];
}

const H = 48;

/** The Schedule Manager's week view: lectures across all batches. */
export function WeekCalendar<E extends CalendarEvent>({ days, events, startHour = 8, endHour = 22, tzLabel, todayIndex, onEventClick }: WeekCalendarProps<E>) {
  const hours: number[] = [];
  for (let i = startHour; i < endHour; i++) hours.push(i);
  return (
    <div className="bl-cal-scroll">
      <div className="bl-cal" style={{ ["--days" as string]: days.length }}>
        <div className="bl-cal-corner">{tzLabel || "IST"}</div>
        {days.map((d, i) => (
          <div key={"h" + i} className={cx("bl-cal-head", todayIndex === i && "today")}>
            {d.label}
            <strong>{d.date}</strong>
          </div>
        ))}
        <div className="bl-cal-hours">
          {hours.map((x) => (
            <div key={x} className="bl-cal-hour">
              {(x < 10 ? "0" : "") + x + ":00"}
            </div>
          ))}
        </div>
        {days.map((_, i) => (
          <div key={"d" + i} className="bl-cal-day" style={{ height: hours.length * H }}>
            {events
              .filter((e) => e.day === i)
              .map((e, j) => {
                const top = ((mins(e.start) - startHour * 60) / 60) * H;
                const ht = Math.max(28, ((mins(e.end) - mins(e.start)) / 60) * H - 2);
                const cls =
                  e.status === "live"
                    ? "live"
                    : e.status === "completed" || e.status === "recording-ready" || e.status === "ended" || e.status === "recording-processing"
                      ? "done"
                      : e.status === "link-missing"
                        ? "nolink"
                        : e.status === "cancelled"
                          ? "cancelled"
                          : "";
                const suffix = e.status === "live" ? " · LIVE" : e.status === "link-missing" ? " · no link" : e.status === "cancelled" ? " · cancelled" : "";
                return (
                  <button
                    key={e.id || j}
                    type="button"
                    className={cx("bl-cal-event", cls)}
                    style={{ top: top + 1, height: ht, textAlign: "left", border: 0 }}
                    onClick={onEventClick ? () => onEventClick(e) : undefined}
                    title={`${e.title} · ${e.start}–${e.end} ${tzLabel || "IST"}`}
                  >
                    <span className="t">{e.start + "–" + e.end + suffix}</span>
                    {e.title}
                    {e.batch ? <span style={{ display: "block", opacity: 0.85, fontWeight: 400 }}>{e.batch}</span> : null}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
