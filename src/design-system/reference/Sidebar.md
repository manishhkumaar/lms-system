# Sidebar

The slate, collapsible left navigation. Its items come from the signed-in user's role, so each role sees only the screens it can use.

**Consumer provides:** `role` (`super-admin` `operations` `course-designer` `admissions` `student`), `active` (the current item key), optional `collapsed` + `onToggle`, `onNavigate(key)`, `badges` (`{leads: 12}`), `brand`, `mark`, or a custom `nav` in the same shape as `Sidebar.nav`.

| Role | Sees |
| --- | --- |
| Super Admin | Everything, plus Team & Roles and Settings |
| Operations Manager | Dashboard, Reports, Leads, Batches, Schedule, Students, Recordings, Attendance |
| Course Designer | Dashboard, Courses, Materials library |
| Admissions Executive | Dashboard, Leads, Interviews, Enrolments |
| Student | Home, My courses, Lecture timeline, Recordings, Materials, Profile |

- Expanded `sidebar-width` (248px) on desktop; `collapsed` (72px, icons with tooltips) below 1280px or on request; on mobile it becomes a drawer over `scrim`.
- Hiding an item is not access control: the server still checks the role, and a direct URL to a forbidden screen shows Access Denied.
