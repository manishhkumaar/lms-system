# Dialog

A modal for short, focused tasks: schedule or reschedule a lecture, add a lead, transfer a student, confirm a destructive action.

**Consumer provides:** `title`, optional `description`, `children` (the form), `footer` (buttons, secondary first, primary last), `onClose`, `open`, `width`. `inline` renders it in place (for previews and docs).

- Title is the action ("Transfer student"); the primary button repeats it.
- Destructive confirmations name the thing: "Cancel lecture 13 for Batch 07? 42 students will be notified."
- On mobile it becomes a bottom sheet.
- Longer editing (Course Editor, Batch setup) gets a full page, not a dialog.
