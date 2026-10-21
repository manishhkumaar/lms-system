# WeekCalendar

The Schedule Manager's week view: lectures across all batches, with live, unlinked and finished sessions told apart.

**Consumer provides:** `days` (`{label, date}`), `events` (`{day, start:'HH:MM', end:'HH:MM', title, batch, status}`), `startHour`, `endHour`, `tzLabel` (shown in the corner, e.g. `IST`), `todayIndex`, `onEventClick(event)` (open Lecture Details or the reschedule `Dialog`).

- Event colours: `scheduled` primary-soft, `live` danger-soft with "LIVE", `link-missing` warning-soft with "no link", finished neutral-soft. The text label is always there too.
- Every time on screen carries its zone. Store start and end as zoned timestamps; render in the viewer's zone and say which.
- Rescheduling notifies the batch and moves the meeting link with the lecture.
