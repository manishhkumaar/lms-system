/*
 * Time zone helpers. Every time is stored as an ISO timestamp with its offset and shown in the
 * viewer's zone with the zone named ("6:30–8:00 PM IST").
 */

export const DEFAULT_TZ = "Asia/Kolkata";

export interface ZoneOption {
  value: string;
  abbr: string;
}

/** Zones offered in selects. Abbreviations for zones without DST are fixed. */
export const ZONES: ZoneOption[] = [
  { value: "Asia/Kolkata", abbr: "IST" },
  { value: "Asia/Dubai", abbr: "GST" },
  { value: "Asia/Singapore", abbr: "SGT" },
  { value: "Europe/London", abbr: "" },
  { value: "America/New_York", abbr: "" },
  { value: "Australia/Sydney", abbr: "" },
];

const FIXED_ABBR: Record<string, string> = { "Asia/Kolkata": "IST", "Asia/Calcutta": "IST", "Asia/Dubai": "GST", "Asia/Singapore": "SGT", UTC: "UTC" };

/** "GMT+05:30" style offset of a zone at an instant, as minutes. */
export function zoneOffsetMinutes(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

export function formatOffset(mins: number): string {
  const sign = mins < 0 ? "-" : "+";
  const a = Math.abs(mins);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

/** Short zone label: IST, GST, BST, EDT… */
export function tzLabel(tz: string, at: Date = new Date()): string {
  if (FIXED_ABBR[tz]) return FIXED_ABBR[tz];
  try {
    const locale = tz.startsWith("Europe/London") ? "en-GB" : tz.startsWith("Australia/") ? "en-AU" : "en-US";
    const name = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
    if (name && !name.startsWith("GMT+") && !name.startsWith("GMT-") && !name.startsWith("UTC+")) return name;
    return `UTC${formatOffset(zoneOffsetMinutes(tz, at))}`;
  } catch {
    return tz;
  }
}

/** Options for a time-zone SelectField: abbreviation, IANA name and UTC offset. */
export function zoneOptions(at: Date = new Date()) {
  return ZONES.map((z) => ({ value: z.value, label: `${tzLabel(z.value, at)} · ${z.value} (UTC${formatOffset(zoneOffsetMinutes(z.value, at))})` }));
}

/** Parts of an instant as seen in a zone. */
export function zonedParts(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday") as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
  };
}

/** YYYY-MM-DD of an instant in a zone. */
export function dateKey(d: Date | string, tz: string = DEFAULT_TZ): string {
  const p = zonedParts(typeof d === "string" ? new Date(d) : d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "HH:MM" of an instant in a zone. */
export function timeKey(d: Date | string, tz: string = DEFAULT_TZ): string {
  const p = zonedParts(typeof d === "string" ? new Date(d) : d, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * Local wall-clock date + time in a zone → ISO timestamp carrying that zone's offset.
 * zonedISO("2026-10-23", "18:30", "Asia/Kolkata") → "2026-10-23T18:30:00+05:30"
 */
export function zonedISO(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let offset = zoneOffsetMinutes(tz, new Date(guess));
  // Re-check once around DST transitions.
  const second = zoneOffsetMinutes(tz, new Date(guess - offset * 60000));
  if (second !== offset) offset = second;
  return `${date}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00${formatOffset(offset)}`;
}

/** An instant as an ISO timestamp carrying the zone's offset (minute precision). */
export function toZonedISO(d: Date | number | string, tz: string): string {
  const date = new Date(d);
  return zonedISO(dateKey(date, tz), timeKey(date, tz), tz);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Day of week for a YYYY-MM-DD date. */
export function weekdayOf(date: string): "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" {
  const [y, m, d] = date.split("-").map(Number);
  return (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Monday of the week containing a date. */
export function startOfWeek(date: string): string {
  const idx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekdayOf(date));
  return addDays(date, -idx);
}

export function minutesBetween(a: string | Date, b: string | Date): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}
