# TextField

A labelled single-line input with optional hint or error text.

**Consumer provides:** `label`, and optional `hint`, `error` (replaces the hint and sets `aria-invalid`), `required`, `mono` (Geist Mono for links, IDs and codes) plus any native input props (`value`, `onChange`, `type`, `placeholder`).

- Labels sit above the field, sentence case, no colon.
- Errors say how to fix it: "Enter a 10-digit mobile number", not "Invalid input".
- Use `mono` for meeting links, batch codes and enrolment IDs.
- Dates and times use native `type="date"`/`type="time"` and always show the time zone next to them (see `WeekCalendar`).
