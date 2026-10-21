/*
 * Formatting rules from the content guidelines:
 * - Dates read day-month: "21 Oct 2026". Times carry a zone and an end: "Wed, 21 Oct · 6:30–8:00 PM IST".
 * - Times in tables use 24-hour mono: 18:30–20:00.
 * - Numbers use Indian grouping (1,28,400) and ₹ for fees.
 */
import { DEFAULT_TZ, tzLabel } from "./time";

const nf = new Intl.NumberFormat("en-IN");

export function formatNumber(n: number): string {
  return nf.format(n);
}

export function formatINR(n: number): string {
  return "₹" + nf.format(Math.round(n));
}

export function formatPercent(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));

/** "21 Oct 2026" */
export function formatDate(d: Date | string | number, tz: string = DEFAULT_TZ): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    // A calendar date has no zone; format it as written.
    const [y, m, day] = d.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, day)));
  }
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(toDate(d));
}

/** "21 Oct" */
export function formatDayMonth(d: Date | string | number, tz: string = DEFAULT_TZ): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, day)));
  }
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, day: "numeric", month: "short" }).format(toDate(d));
}

/** "Wed, 21 Oct" */
export function formatWeekdayDate(d: Date | string | number, tz: string = DEFAULT_TZ): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, day)));
  }
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(toDate(d));
}

function time12Parts(d: Date, tz: string) {
  const s = new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  const m = s.match(/^(.*?)\s?(am|pm)$/i);
  return m ? { clock: m[1].trim(), mer: m[2].toUpperCase() } : { clock: s, mer: "" };
}

/** "6:30 PM" */
export function formatTime(d: Date | string | number, tz: string = DEFAULT_TZ): string {
  const p = time12Parts(toDate(d), tz);
  return p.mer ? `${p.clock} ${p.mer}` : p.clock;
}

/** "6:30–8:00 PM", or "11:30 AM–1:00 PM" across noon. */
export function formatTimeRange(start: Date | string, end: Date | string, tz: string = DEFAULT_TZ): string {
  const a = time12Parts(toDate(start), tz);
  const b = time12Parts(toDate(end), tz);
  if (a.mer === b.mer) return `${a.clock}–${b.clock} ${b.mer}`.trim();
  return `${a.clock} ${a.mer}–${b.clock} ${b.mer}`;
}

/** "Wed, 21 Oct · 6:30–8:00 PM IST" */
export function formatWhen(start: Date | string, end: Date | string, tz: string = DEFAULT_TZ): string {
  return `${formatWeekdayDate(start, tz)} · ${formatTimeRange(start, end, tz)} ${tzLabel(tz, toDate(start))}`;
}

/** "18:30" */
export function formatTime24(d: Date | string | number, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(toDate(d));
}

/** "18:30–20:00" */
export function formatRange24(start: Date | string, end: Date | string, tz: string = DEFAULT_TZ): string {
  return `${formatTime24(start, tz)}–${formatTime24(end, tz)}`;
}

/** "21 Oct 2026, 18:30 IST" */
export function formatDateTime(d: Date | string | number, tz: string = DEFAULT_TZ): string {
  return `${formatDate(d, tz)}, ${formatTime24(d, tz)} ${tzLabel(tz, toDate(d))}`;
}

/** "Thu 23 Oct · 11:00 IST" (Kanban interview line) */
export function formatShortWhen(d: Date | string | number, tz: string = DEFAULT_TZ): string {
  return `${formatWeekdayDate(d, tz).replace(",", "")} · ${formatTime24(d, tz)} ${tzLabel(tz, toDate(d))}`;
}

/** "1h 28m", "45m" */
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "Just now", "5 min ago", "2h ago", "Yesterday", "3 days ago", then the date. */
export function formatRelative(d: Date | string | number, now: number = Date.now(), tz: string = DEFAULT_TZ): string {
  const diff = now - toDate(d).getTime();
  const future = diff < 0;
  const a = Math.abs(diff);
  const min = Math.round(a / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return future ? `In ${min} min` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return future ? `In ${h}h` : `${h}h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return future ? "Tomorrow" : "Yesterday";
  if (days < 7) return future ? `In ${days} days` : `${days} days ago`;
  return formatDate(d, tz);
}

/** "42 of 50 seats filled" */
export function seatsLabel(filled: number, capacity: number): string {
  return `${formatNumber(filled)} of ${formatNumber(capacity)} seats filled`;
}

/** "1 student" / "42 students" */
export function plural(n: number, one: string, many = one + "s"): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** "Good morning" / "Good afternoon" / "Good evening" in the viewer's zone. */
export function greeting(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(now));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}
