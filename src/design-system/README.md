# Batch LMS design system (in code)

This folder is the coded version of the **Batch LMS** design system. Product rules, content rules and visual foundations are in [GUIDELINES.md](GUIDELINES.md); per-component guidance from the original system is in [reference/](reference/).

## Files

| File | What it is |
| --- | --- |
| `tokens.json` | Source of truth for colour (light + dark), type, spacing, radius, shadow, size and z-index tokens. |
| `tokens.css` | Generated from `tokens.json` by `npm run tokens`. Don't edit by hand. |
| `components.css` | The system's component styles (`bl-*` classes), unchanged from the published bundle except the font import, which `index.html` does. |
| `extensions.css` | Styles for the components the app added (below), using the same tokens and rules. |
| `components/*.tsx` | Typed React ports of every component in the bundle. |
| `index.ts` | Public entry: `import { Button, StatusChip } from "@/design-system"`. |

## Components from the system

`Icon`, `Button`, `StatusChip`, `TextField`, `SelectField`, `Toggle`, `Tabs`, `Sidebar`, `Topbar`, `FilterBar`, `DataTable` (+ `Progress`), `StatCard`, `Dialog`, `KanbanBoard` (+ `LeadCard`), `WeekCalendar`, `LiveClassCard`, `EmptyState`.

Props match the system's `index.d.ts` (kept as `reference/original-index.d.ts.txt`). Small, compatible additions:

- **Button** forwards refs; an icon-only button gets square sizing.
- **FilterBar** takes `searchValue`/`onSearch`, and a filter can carry `options` + `onSelect` to open a menu of choices.
- **DataTable** rows are keyboard-activatable when `onRowClick` is set.
- **Dialog** traps focus, closes on Escape, locks page scroll, renders in a portal, and takes `onSubmit` to wrap its body in a form.
- **KanbanBoard** wires drag and drop when given `onMove(lead, stage)`, shows the + button when given `onAdd(stage)`, and sorts leads with `followUpDue` to the top.
- **Topbar** takes `searchSlot`, `notifications` and `userMenu`.
- **Sidebar** shows the collapse control only when `onToggle` is given (the mobile drawer has none).
- **Icon** has extra glyphs drawn in the same 24-unit, 1.75-stroke style: `mail`, `logout`, `edit`, `trash`, `copy`, `external`, `sun`, `moon`, `lock`, `note`, `grid`, `list`, `download`.

## Components added for the app

All in `components/Menu.tsx`, `components/Fields.tsx` and `components/Extras.tsx`.

| Component | Use |
| --- | --- |
| `Menu` | Small dropdown (`shadow-md`, `z-dropdown`); the user menu, row actions and filter choices. |
| `TextAreaField` | Multi-line `TextField` (notes, agendas). |
| `Checkbox` | Choices inside a form saved later. Settings that apply immediately stay `Toggle`. |
| `Card` | `bl-card` with an optional `h3` title, description and actions. |
| `SectionHeader` | `h2` section title inside a page. |
| `Banner` | Inline message on a `*-soft` fill with `*-ink` text and an icon, always with words. |
| `Avatar` | Initials on `primary-soft`. |
| `MetaList` | Label/value pairs on detail pages. |
| `SegmentedControl` | Two or three exclusive views, e.g. the Leads Table / Kanban switch in the `FilterBar`. |
| `SidePanel` | Right-hand panel for a lead's notes and follow-ups; a bottom sheet on mobile. |
| `ToastProvider` / `useToast` | Confirmation after an action ("Link published"); `z-toast`. |
| `BottomNav` | The student portal's tab bar under 768px. |
| `CopyField` | Read-only mono value with a copy button (meeting and activation links). |
| `StatGrid` | Four `StatCard`s per row on desktop, two on tablet, one on mobile. |

## Rules worth repeating

- One primary action per page, placed in the `Topbar`.
- Statuses only through `StatusChip` keys; the word carries the meaning.
- **Joined ≠ attended.** `joined` is a Join click; only `present` counts, labelled "Verified attendance".
- Every time has a zone and an end. Use `src/lib/format.ts` (`formatWhen`, `formatRange24`) rather than formatting by hand.
- Use the `on-primary` token on primary fills, never literal white: dark mode's primary is light.
