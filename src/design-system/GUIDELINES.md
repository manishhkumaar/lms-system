A modern EdTech SaaS system for a batch-based learning platform: one sign-in, role-based dashboards for Super Admin, Operations Manager, Course Designer, Admissions Executive and Student. The admin portal is desktop-first and dense; the student portal is mobile-first and calm.

## Product model

Build every screen on these objects and keep their names exact in the UI.

| Object | What it is | Owned by |
| --- | --- | --- |
| **Course** | The reusable curriculum: syllabus, modules, lecture templates, optional materials | Course Designer |
| **Batch** | One scheduled delivery of a course: start/end dates, capacity, instructors, enrolled students | Operations Manager |
| **Lecture** | One live session of a batch: date, start and end time with zone, meeting link, status | Operations Manager |
| **Recording** | The video of a finished lecture, uploaded after the session | Operations Manager |
| **Lead** | A prospective student moving through admissions | Admissions Executive |
| **Student** | A person enrolled in one or more batches, with progress and history | Operations / Admissions |

A course is never "live"; a lecture is. A student enrols in a **batch**, not a course.

## Screens

- **Admin / Operations portal** (desktop-first, `Sidebar` + `Topbar`): Dashboard, Leads CRM, Courses, Course Editor, Batch Management, Batch Details, Schedule Calendar, Lecture Details, Student Directory, Student Profile, Recordings, Attendance, Reports, Team & Roles, Settings.
- **Student portal** (mobile-first, bottom tab bar under 768px, `Sidebar` with `role="student"` above): Student Dashboard, My Courses, Course Overview, Lecture Timeline, Live Class, Materials Viewer, Recordings Library, Profile.
- **Authentication** (centred card on `surface`, `radius-lg`, `space-8` from the top): Login, Forgot Password, Reset Password, First-Time Account Activation, Access Denied.

First-version priority flow: Leads → Student Enrolment → Course → Batch → Lecture Scheduling → Live Class → Recording. Materials stay optional at course level (`Toggle`).

## Content fundamentals

- Write in Indian English: colour, organise, enrolment, programme where it's a proper noun. Sentence case everywhere, including buttons and page titles.
- Address students as "you"; never "the learner". Admin copy is plain and operational: "42 of 50 seats filled", "2 links not published".
- Buttons start with a verb: "Schedule lecture", "Publish link", "Enrol student", "Move to Interviewed".
- Every time has a zone and an end: "Wed, 21 Oct · 6:30–8:00 PM IST". Dates read day-month: "21 Oct 2026". Times in tables use 24-hour mono (`time` style): `18:30–20:00`.
- Numbers use Indian grouping (`1,28,400`) and `₹` for fees.
- No emoji in the interface. No exclamation marks except in a first-time welcome.
- Disabled states always say why: "Join opens at 6:30 PM IST", "Only students in this batch can join".

## Visual foundations

**Colour.** Light surfaces with a slate sidebar and one blue. Page on `surface`; cards, tables, dialogs and fields on `surface-raised`; table headers and Kanban wells on `surface-sunken`. Text in `ink`, secondary in `ink-muted`, captions in `ink-subtle`, all legible on all three surfaces in both themes. `primary` is for the one main action, selection, links and focus; text on it is `on-primary`. Status colours (`success`, `warning`, `danger`) appear as text on `surface`/`surface-raised` or as `*-soft` fills with `*-ink` text, and always with a word. `danger` also marks Live. The sidebar uses `nav`, `nav-active`, `nav-ink`, `nav-ink-active` and `nav-accent`.

**Type.** Geist for everything, Geist Mono for times, dates, IDs, countdowns and stat values (tabular figures). Admin body is `body` (14px); student body is `body-lg` (16px). Headings: `h1` page title, `h2` section and dialog, `h3` card. `display` once per screen at most. Labels, buttons and tabs use `label`; sidebar groups and stat titles use `overline`.

**Spacing and layout.** 8px grid: `space-1` (8) through `space-8` (64), with `space-0-5` (4) and `space-1-5` (12) for tight insides. Admin pages: `sidebar-width` sidebar (collapses to `sidebar-collapsed`), `topbar-height` bar, `space-4` gutters, content up to `content-max`. Student pages: `space-2` gutters on mobile, single column, cards stacked with `space-2` gaps, reading text up to `reading-max`.

**Shape and depth.** `radius-sm` for controls, `radius-md` for cards and tables, `radius-lg` for dialogs and the live-class card, `radius-full` for chips and avatars. Borders do the separating (`border` hairlines); shadows are light: `shadow-sm` at rest, `shadow-md` for menus and dragged cards, `shadow-lg` for dialogs. No gradients, no coloured left-border cards.

**Controls.** Admin controls are `control-height` (36px); student and mobile controls are `control-height-touch` (44px). Input and toggle edges use `border-strong`. The focus ring is a solid 2px `primary` outline offset 2px (inside the sidebar, `nav-accent`); it meets 3:1 on every surface.

**Motion.** 120–180ms ease for hovers, the sidebar collapse and toggles. Only the Live dot pulses, and it stops under reduced motion.

**Themes.** Light is primary; Dark mirrors every token. In dark, `primary` lightens, so `on-primary` turns dark: always use the token, never literal white.

## Rules that matter

- **Role-based navigation.** `Sidebar` takes the role and shows only that role's screens (table in its guidelines). The server still enforces access; a forbidden URL lands on Access Denied with the user's role named and a way back to their dashboard.
- **Live class.** Before start: countdown and disabled Join. From start to end: Join enabled only if the link is published **and** the student is in that batch. After end: the recording once uploaded. Show explicit start and end times with zone. Use `LiveClassCard`.
- **Joined ≠ attended.** A Join click is `joined`. Attendance counts only `present`, verified by the meeting provider or confirmed by Operations; until then it's `unverified`. Reports label it "Verified attendance".
- **Leads pipeline.** New → Contacted → Interview scheduled → Interviewed → Selected / Rejected → Enrolled, in `KanbanBoard` and a `DataTable` view, with notes and follow-ups on each lead.
- **Statuses** use `StatusChip` keys only; don't invent colours.

## Iconography

Use the system's own `Icon` set: a 24-unit line set, 1.75 stroke, round caps, drawn in `currentColor` at 16px (20px with `size="lg"`). It covers navigation (home, inbox, book, layers, calendar, users, video, checklist, chart, shield, settings) and actions (plus, upload, search, filter, link, play, transfer). These are generic glyphs drawn for this system, not a brand's icons; where a glyph is missing, add it in the same style or use Lucide, which matches the stroke and caps. No emoji as icons.

## Brand

No logo was provided. The sidebar shows a `primary` square with a letter mark and the product name in plain type; replace both through `Sidebar`'s `mark` and `brand` props when the identity is ready.
