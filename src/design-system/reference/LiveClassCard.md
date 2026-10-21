# LiveClassCard

The student's next or current class: countdown before it starts, Join while it's on, and the recording after it ends.

**Consumer provides:** `title`, `batch`, `start` and `end` (ISO timestamps with offset), `timeZone` (IANA, default `Asia/Kolkata`), `tzLabel` (`IST`), `linkPublished`, `enrolled`, `meetingUrl` or `onJoin`, `recording` (`{duration}`) once uploaded, `onWatch`. Optional `now` freezes the clock (tests, previews) and `joinOpensMinutesBefore` (default 0).

Behaviour, in order:
1. **Before start:** countdown (`countdown` style) and a disabled button reading "Join opens at 6:30 PM IST".
2. **From start to end:** Join is enabled only when the link is published **and** the student belongs to this batch. Otherwise it stays disabled with the reason underneath in `warning`.
3. **After end:** "Recording will appear here once it's uploaded", then the recording with Watch once `recording` is set.

- Always show start **and** end time with the zone.
- Clicking Join records `joined`, not attendance. Attendance becomes `present` only once verified (see `StatusChip`).
- Use `touch` sizing: this card is mobile-first.
