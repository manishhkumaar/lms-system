# KanbanBoard

The Leads CRM pipeline: New → Contacted → Interview scheduled → Interviewed → Selected / Rejected → Enrolled. Exports `LeadCard` for single cards.

**Consumer provides:** `leads` (`{id, stage, name, course, source?, interview?, followUp?, updated?, owner?, status?}`), optional `stages` (defaults to `KanbanBoard.stages`), `onOpen(lead)`. Drag-and-drop wiring is the consumer's: cards are `draggable`; add the `dragging` class while one moves.

- Each column header is a `StatusChip` with the stage name and a count.
- A due follow-up shows in `warning` on the card with a clock icon; overdue leads should sort to the top.
- Moving a lead to Interview scheduled opens a `Dialog` asking for date, time and zone; moving to Enrolled asks for the batch.
- The same data has a Table view (`DataTable`) for bulk actions; the switch lives in the `FilterBar`.
