# SelectField

A labelled native select for picking one value from a short list (course, batch, instructor, time zone).

**Consumer provides:** `label`, `options` (strings or `{value, label}`), optional `hint`, `error`, and native select props.

- Over about 12 options, use a searchable combobox instead.
- Time-zone options show the abbreviation, the IANA name and the UTC offset.
