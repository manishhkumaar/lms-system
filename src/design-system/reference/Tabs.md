# Tabs

Switches between views of one record: Batch Details (Overview, Students, Lectures, Recordings, Attendance), Student Profile, Course Editor.

**Consumer provides:** `items` (`{value, label, count?}`), and `value` + `onChange` (controlled) or `defaultValue`.

- Keep to seven tabs or fewer; on mobile the row scrolls sideways.
- `count` shows record totals, not unread badges.
