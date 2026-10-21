# DataTable

The list view for students, batches, leads, lectures, recordings and attendance.

**Consumer provides:** `columns` (`{key, label, render?, numeric?, width?}`), `rows` (objects with an `id`), optional `toolbar` (usually a `FilterBar`), `footer` (count + pagination), `onRowClick(row)`, `selectedId`, `empty` (an `EmptyState` shown when there are no rows). Also exports `Progress` (`value` 0–100) for progress cells.

- First column is the record's name in `ink`; the rest are `ink-muted`. Put a secondary line under the name with `bl-cell-sub`.
- Numbers and IDs are right-aligned (`numeric`) or set in mono so digits line up.
- Status columns use `StatusChip`, never coloured text alone.
- Label attendance columns "Verified attendance" so nobody mistakes Join clicks for presence.
