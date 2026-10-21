import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { StatusChip } from "./StatusChip";

export interface LiveClassCardProps {
  title: string;
  batch: string;
  /** ISO timestamps with offset, e.g. 2026-10-21T18:30:00+05:30 */
  start: string;
  end: string;
  /** IANA zone used for display. Default Asia/Kolkata. */
  timeZone?: string;
  tzLabel?: string;
  linkPublished: boolean;
  enrolled?: boolean;
  meetingUrl?: string;
  onJoin?: () => void;
  recording?: { duration?: string } | null;
  onWatch?: () => void;
  /** Freezes the clock (tests, previews). */
  now?: string | number;
  joinOpensMinutesBefore?: number;
  className?: string;
}

export type LiveState = "upcoming" | "live" | "recording-ready" | "recording-processing";

function fmtTime(d: Date, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
      .format(d)
      .replace(/\s?(am|pm)/i, (m) => " " + m.trim().toUpperCase());
  } catch {
    return d.toTimeString().slice(0, 5);
  }
}

function fmtDate(d: Date, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(d);
  } catch {
    return d.toDateString();
  }
}

const pad = (n: number) => (n < 10 ? "0" : "") + n;

export function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return d > 0 ? `${d}d ${pad(hh)}h ${pad(mm)}m` : `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

export function liveState(p: Pick<LiveClassCardProps, "start" | "end" | "joinOpensMinutesBefore" | "recording">, now: number): LiveState {
  const start = new Date(p.start).getTime();
  const end = new Date(p.end).getTime();
  const opens = start - (p.joinOpensMinutesBefore || 0) * 60000;
  if (now < opens) return "upcoming";
  if (now < end) return "live";
  return p.recording ? "recording-ready" : "recording-processing";
}

/** The student's next or current class: countdown, Join while it's on, recording after. */
export function LiveClassCard(p: LiveClassCardProps) {
  const fixed = p.now != null;
  const [tick, setTick] = useState(() => (fixed ? new Date(p.now!).getTime() : Date.now()));
  const now = fixed ? new Date(p.now!).getTime() : tick;
  useEffect(() => {
    if (fixed) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [fixed]);

  const tz = p.timeZone || "Asia/Kolkata";
  const tzl = p.tzLabel || "IST";
  const start = new Date(p.start);
  const end = new Date(p.end);
  const state = liveState(p, now);
  const canJoin = state === "live" && p.linkPublished && p.enrolled !== false;
  const reason =
    p.enrolled === false
      ? "Only students in this batch can join."
      : state === "live" && !p.linkPublished
        ? "The meeting link hasn't been published yet. Your batch coordinator has been notified."
        : null;
  const chip = state === "live" ? "live" : state === "upcoming" ? (p.linkPublished ? "scheduled" : "link-missing") : state;

  let body;
  if (state === "upcoming") {
    body = (
      <>
        <div className="bl-live-count" aria-live="off">
          <b>{fmtCountdown(start.getTime() - now)}</b>
          <span>until class starts</span>
        </div>
        <Button variant="primary" touch block icon="video" disabled>
          {"Join opens at " + fmtTime(new Date(start.getTime() - (p.joinOpensMinutesBefore || 0) * 60000), tz) + " " + tzl}
        </Button>
      </>
    );
  } else if (state === "live") {
    body = (
      <>
        <Button
          variant="primary"
          touch
          block
          icon="video"
          disabled={!canJoin}
          onClick={
            canJoin
              ? () => {
                  if (p.onJoin) p.onJoin();
                  else if (p.meetingUrl) window.open(p.meetingUrl, "_blank", "noopener");
                }
              : undefined
          }
        >
          {canJoin ? "Join class" : "Join unavailable"}
        </Button>
        <div className="bl-live-note">
          <Icon name="clock" />
          {`Ends at ${fmtTime(end, tz)} ${tzl} · ${fmtCountdown(end.getTime() - now)} left`}
        </div>
      </>
    );
  } else if (state === "recording-ready") {
    body = (
      <>
        <div className="bl-live-rec">
          <span className="bl-live-thumb">
            <Icon name="play" size="lg" />
          </span>
          <div>
            <div className="bl-live-rec-title">Recording available</div>
            <div className="bl-live-rec-meta bl-mono">{p.recording?.duration || ""}</div>
          </div>
        </div>
        <Button variant="secondary" touch block icon="play" onClick={p.onWatch}>
          Watch recording
        </Button>
      </>
    );
  } else {
    body = (
      <div className="bl-live-note">
        <Icon name="clock" />
        {`Class ended at ${fmtTime(end, tz)} ${tzl}. The recording will appear here once it's uploaded.`}
      </div>
    );
  }

  return (
    <article className={["bl-live", p.className].filter(Boolean).join(" ")}>
      <div className="bl-live-top">
        <StatusChip status={chip} />
        <span className="bl-live-batch">{p.batch}</span>
      </div>
      <div>
        <h3 className="bl-live-title">{p.title}</h3>
        <div className="bl-live-when">
          <Icon name="calendar" />
          {`${fmtDate(start, tz)} · ${fmtTime(start, tz)}–${fmtTime(end, tz)} ${tzl}`}
        </div>
      </div>
      {body}
      {reason ? (
        <div className="bl-live-note warn" role="status">
          <Icon name="alert" />
          {reason}
        </div>
      ) : null}
    </article>
  );
}

LiveClassCard.stateAt = liveState;
