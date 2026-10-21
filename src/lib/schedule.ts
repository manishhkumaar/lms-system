/* Scheduling rules shared by the browser and the API. */
import { addDays, weekdayOf } from "./time";

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/** Dates for n sessions from startDate on the given weekdays. */
export function sessionDates(startDate: string, days: Weekday[], n: number): string[] {
  const out: string[] = [];
  if (!days.length) return out;
  let d = startDate;
  let guard = 0;
  while (out.length < n && guard++ < 3660) {
    if (days.includes(weekdayOf(d))) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function isValidMeetingUrl(url: string) {
  return /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url.trim());
}

/** "Full-Stack Web Development" → "Full-Stack Web" for batch names. */
export function shortCourseTitle(title: string) {
  return title.replace(/ Development| Foundations| Essentials| with Python/g, "");
}
