# Batch LMS

A batch-based learning platform with one sign-in and role-based dashboards for **Super Admin**, **Operations Manager**, **Course Designer**, **Admissions Executive** and **Student**. It is built on the *Batch LMS* design system: the admin portal is desktop-first and dense, and the student portal is mobile-first and calm.

**Stack:** Next.js 16 (App Router) for the screens *and* the API, in one repo, with Supabase for Postgres, Auth and Storage.

The first-version flow works end to end:

**Leads → Student enrolment → Course → Batch → Lecture scheduling → Live class → Recording**

## Quick start

### 1. Install

```bash
npm install
```

### 2. Set up the database

Choose one of these.

**Your hosted Supabase project** (the one in `.env.local`):

```bash
npx supabase login                                     # once, opens the browser
npx supabase link --project-ref ikdetjwaablpevroleor   # asks for the database password
npm run db:push                                        # applies supabase/migrations
```

Then copy the **secret key** (Supabase dashboard → Project Settings → API Keys → Secret keys) into `SUPABASE_SECRET_KEY` in `.env.local`. The server needs it to activate invited accounts, and the seed script needs it too.

In the dashboard under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/**` to the Redirect URLs, so password-reset emails come back to the app.

**Local Supabase in Docker** (no cloud account needed):

```bash
npm run db:start      # starts Postgres, Auth, Storage and Mailpit; applies migrations
npx supabase status   # prints the local URL and keys
```

Put the printed API URL, publishable key and secret key into `.env.local`. Local emails (password resets) arrive in Mailpit at http://127.0.0.1:54324.

### 3. Load demo data (optional)

```bash
npm run db:seed              # demo accounts, courses, batches, a live class right now…
npm run db:seed -- --reset   # wipe LMS data and demo accounts, then reseed
```

### 4. Run

```bash
npm run dev    # http://localhost:3000
```

### Demo accounts

After `npm run db:seed`, every account uses the password **`demo1234`**. When `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true`, the sign-in page has one-click buttons for them.

| Role | Email | What to try |
| --- | --- | --- |
| Super Admin | kavya@example.in | Everything, plus Team & Roles and Settings |
| Operations Manager | anjali@example.in | A lecture is **live now**, the next one has no link, one finished lecture is waiting for its recording |
| Course Designer | lakshmi@example.in | Edit the curriculum and turn materials on or off; *Cloud & DevOps* is a draft |
| Admissions Executive | meera@example.in | Leads Kanban with drag and drop, follow-ups, interviews, enrolment |
| Student | priya@example.in | Join the live class, watch recordings, read materials |
| Student | sneha@example.in | Enrolled in a full batch that hasn't started yet |
| Student | rahul@example.in | Completed batch; that course has materials off, so there's no Materials tab |
| Invited staff | `/activate?token=welcome-deepak` | First-time account activation |

Demo data is generated around the time you seed it. Reseed with `--reset` to get a live class again on another day.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (catches un-awaited API calls) |
| `npm test` | Unit tests, plus the database suite: every migration on PGlite (Postgres in WebAssembly, no Docker), checking row-level security and the SQL functions role by role |
| `npm run db:start` / `db:stop` | Local Supabase in Docker |
| `npm run db:push` | Apply migrations to the linked hosted project |
| `npm run db:reset` | Recreate the local database from migrations |
| `npm run db:seed` | Load demo data (needs `SUPABASE_SECRET_KEY`) |
| `npm run tokens` | Regenerate design tokens CSS from `tokens.json` |

## How it's built

```
supabase/
  migrations/      Schema, row-level security, storage buckets and policies, SQL functions
  tests/           Policy and function tests (PGlite)
scripts/seed.ts    Demo data loader
src/
  proxy.ts         Refreshes the Supabase session on every request; sends signed-out visitors to /login
  app/             Next.js routes
    api/           The REST API (Route Handlers): leads, students, enrolments, courses, modules,
                   templates, materials, batches, lectures, recordings, attendance, team, users, settings…
    admin/         Staff portal pages; each checks the role access table on the server
    learn/         Student portal pages
    login, activate, forgot-password, reset-password, access-denied, auth/callback
  server/          API building blocks: auth context and role checks, validation, row → domain mappers,
                   loaders, the bootstrap snapshot, page guards
  utils/supabase/  Supabase clients: browser, server (cookies), proxy, and admin (secret key, server only)
  data/            Domain types, the client store, the API client and actions, selectors (derived state)
  screens/         The 34 screens (client components)
  layouts/         Admin shell (Sidebar + Topbar), student shell (bottom tabs on mobile), auth card
  design-system/   Tokens, component CSS and typed React components from the Batch LMS system
```

### How data flows

1. Signing in uses Supabase Auth. The session lives in cookies, and `src/proxy.ts` refreshes it on every request.
2. Portal layouts check the person's **profile role** on the server. Each admin page also checks the access table in `src/core/access.ts`. A forbidden URL redirects to Access Denied, which names the person's role.
3. The portal loads `GET /api/bootstrap`: everything the person may see, as decided by **Postgres row-level security**. Staff get the organisation; a student gets only their own batches, published links, and published recordings.
4. Every change calls an API route (`src/data/actions.ts` → `src/app/api/**`). The route validates the input, checks the role, and writes through the person's own Supabase session, so RLS still applies. It then returns a **patch** of the changed records, which updates the screen without a refetch. The portal also refreshes every minute and when the tab regains focus, so other people's changes appear.
5. Steps that must be atomic run as SQL functions:
   - seat-checked enrolment (the batch row is locked, so two people can't take the last seat);
   - transfers;
   - a student's Join;
   - attendance import;
   - invitations.
6. Recordings and material files upload from the browser straight to Supabase Storage. Downloads and streaming use short-lived signed links, and storage policies only allow people who can see the record.

### Product rules the code enforces

- **A course is never "live"; a lecture is.** Lecture and batch states are derived from time and data, never stored.
- **A student enrols in a batch, not a course.** Enrolment checks seats in the database; transfers keep attendance history with the old batch.
- **Live class:**
  - Before the start, Join is disabled and shows the opening time.
  - From start to end, Join works only if the link is published and the student is in that batch. The database checks this again in `record_join`.
  - After the end, the recording appears once it's uploaded and published.
- **Joined ≠ attended.** A Join click records `joined`. Only `present` counts, verified by the provider import or by Operations, and reports label it "Verified attendance".
- **Role-based access** is enforced three times: hidden navigation, server page guards, and row-level security.
- **Materials are optional per course.** When they're off, students can't see them at all, in the UI or through the database.

## Before production

- **Meeting provider:** "Import from meeting provider" currently treats Join clicks as the participant report. Connect Zoom, Google Meet or Teams reports to verify real attendance.
- **Large recordings:** uploads use standard Storage uploads. For multi-gigabyte files, switch to resumable (TUS) uploads and raise the bucket's size limit.
- **Email:** invitations show a copyable activation link to staff. Send it by email as well (for example, a Supabase Edge Function or your email provider).

## Design system

See [src/design-system/README.md](src/design-system/README.md) for the component list and the additions this app made, and [src/design-system/GUIDELINES.md](src/design-system/GUIDELINES.md) for the product, content and visual rules.
