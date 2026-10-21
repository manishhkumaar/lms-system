# Toggle

An on/off switch for a setting that applies immediately, such as the course-level Materials ON/OFF.

**Consumer provides:** `label`, optional `description`, `checked` + `onChange(checked)` (controlled) or `defaultChecked`, `disabled`.

- Use for settings, not for choices inside a form that's saved later (use a checkbox there).
- Materials are optional at the course level: when off, hide the Materials tab in the student portal entirely rather than showing it empty.
