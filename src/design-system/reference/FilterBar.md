# FilterBar

The search box and filter pills that sit at the top of a `DataTable` or Kanban board.

**Consumer provides:** `searchPlaceholder`, `filters` (`{label, value?, onClick}`: a pill with a `value` is shown as applied), `end` (actions such as Export or a Table/Kanban view switch).

- Applied filters show their value ("Batch: FSW-07") so a screenshot explains itself.
- Put the view switch (Table / Kanban) for Leads in `end`.
