/*
 * Loads the demo data into Supabase: auth accounts (password demo1234), courses, batches, lectures,
 * recordings, leads, students, enrolments and attendance, generated around the current time.
 *
 *   npm run db:seed            # adds demo data (fails if it's already there)
 *   npm run db:seed -- --reset # deletes ALL LMS data and LMS accounts first (never on a live project)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (bypasses row-level security).
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createSeed, DEMO_PASSWORD } from "../src/data/seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is empty in .env.local. Set it to your project URL, e.g. https://your-ref.supabase.co");
  process.exit(1);
}
if (!key) {
  console.error(
    "SUPABASE_SECRET_KEY is empty in .env.local.\n" +
      "Copy it from the Supabase dashboard → Project Settings → API Keys → Secret keys (it starts with sb_secret_).\n" +
      "DATABASE_URL isn't enough: creating the demo sign-in accounts goes through Supabase Auth's admin API.",
  );
  process.exit(1);
}
if (key.startsWith("sb_publishable_")) {
  console.error("SUPABASE_SECRET_KEY holds the publishable key. Use the secret key (starts with sb_secret_) instead.");
  process.exit(1);
}
// supabase-js needs a WebSocket class; Node 20 has none built in (Node 22 does).
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: (globalThis.WebSocket ?? WebSocket) as never },
});
const reset = process.argv.includes("--reset");

async function insert(table: string, rows: object[], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

async function wipe(emails: string[]) {
  console.log("Deleting existing LMS data…");
  // Children first; profiles go with their auth users.
  for (const table of ["attendance", "recordings", "lecture_links", "lectures", "enrolments", "lead_activity", "invitations", "leads", "students", "batches", "materials", "lecture_templates", "course_modules", "courses"]) {
    const { error } = await sb.from(table).delete().not(table === "lecture_links" ? "lecture_id" : "id", "is", null);
    if (error) throw new Error(`wipe ${table}: ${error.message}`);
  }
  // Every LMS account (anyone with a profile, including people who activated invites) plus the demo emails.
  const { data: profiles, error: pErr } = await sb.from("profiles").select("id");
  if (pErr) throw new Error(`wipe profiles: ${pErr.message}`);
  const lmsIds = new Set((profiles || []).map((p: { id: string }) => p.id));
  const wanted = new Set(emails.map((e) => e.toLowerCase()));
  const doomed: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (lmsIds.has(u.id) || (u.email && wanted.has(u.email.toLowerCase()))) doomed.push(u.id);
    if (data.users.length < 200) break;
  }
  for (const id of doomed) {
    const { error } = await sb.auth.admin.deleteUser(id);
    if (error) throw new Error(`delete account: ${error.message}`);
  }
  console.log(`  removed ${doomed.length} accounts`);
}

async function main() {
  const db = createSeed(Date.now());
  const active = db.users.filter((u) => u.status === "active");

  const { error: schemaError } = await sb.from("courses").select("id", { count: "exact", head: true });
  if (schemaError) {
    if (schemaError.code === "PGRST205" || schemaError.code === "42P01") {
      console.error("The LMS tables don't exist in this project yet. Push the schema first: npm run db:push");
    } else {
      console.error(`Couldn't reach the database: ${schemaError.message}`);
    }
    process.exit(1);
  }
  if (reset) await wipe(active.map((u) => u.email));

  const { count } = await sb.from("courses").select("id", { count: "exact", head: true });
  if (count) {
    console.error("Demo data is already loaded. Run `npm run db:seed -- --reset` to replace it.");
    process.exit(1);
  }

  console.log("Creating demo accounts…");
  const uid = new Map<string, string>(); // seed user id → auth user id
  for (const u of active) {
    const { data, error } = await sb.auth.admin.createUser({ email: u.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name: u.name } });
    if (error) throw new Error(`${u.email}: ${error.message}`);
    uid.set(u.id, data.user.id);
  }
  const mapUser = (id?: string) => (id ? uid.get(id) || null : null);
  await insert(
    "profiles",
    active.map((u) => ({ id: uid.get(u.id), name: u.name, email: u.email, phone: u.phone || null, role: u.role, time_zone: u.timeZone, created_at: u.createdAt, last_active_at: u.lastActiveAt || null })),
  );

  console.log("Loading curriculum and delivery…");
  await insert(
    "courses",
    db.courses.map((c) => ({ id: c.id, code: c.code, title: c.title, summary: c.summary, level: c.level, duration_weeks: c.durationWeeks, fee: c.fee, status: c.status, materials_enabled: c.materialsEnabled, designer_id: mapUser(c.designerId), updated_at: c.updatedAt })),
  );
  await insert("course_modules", db.courses.flatMap((c) => c.modules.map((m, i) => ({ id: m.id, course_id: c.id, title: m.title, position: i }))));
  await insert(
    "lecture_templates",
    db.courses.flatMap((c) => c.modules.flatMap((m) => m.lectures.map((t, i) => ({ id: t.id, module_id: m.id, title: t.title, duration_mins: t.durationMins, summary: t.summary || null, position: i })))),
  );
  await insert(
    "materials",
    db.materials.map((m) => ({ id: m.id, course_id: m.courseId, module_id: m.moduleId || null, title: m.title, kind: m.kind, body: m.body || null, url: m.url || null, file_name: m.fileName || null, size_kb: m.sizeKb || null, updated_at: m.updatedAt })),
  );
  await insert(
    "batches",
    db.batches.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      course_id: b.courseId,
      start_date: b.startDate,
      end_date: b.endDate,
      capacity: b.capacity,
      instructors: b.instructors,
      time_zone: b.timeZone,
      days: b.days,
      slot_start: b.slotStart,
      slot_end: b.slotEnd,
      lifecycle: b.lifecycle,
      owner_id: mapUser(b.ownerId),
      created_at: b.createdAt,
    })),
  );
  await insert(
    "lectures",
    db.lectures.map((l) => ({ id: l.id, batch_id: l.batchId, number: l.number, title: l.title, start_at: l.start, end_at: l.end, time_zone: l.timeZone, instructor: l.instructor || null, status: l.status, previous_start: l.previousStart || null, agenda: l.agenda || null })),
  );
  await insert(
    "lecture_links",
    db.lectures.filter((l) => l.meetingUrl).map((l) => ({ lecture_id: l.id, meeting_url: l.meetingUrl, published: l.linkPublished })),
  );

  console.log("Loading people…");
  await insert(
    "students",
    db.students.map((s) => ({ id: s.id, name: s.name, email: s.email.toLowerCase(), phone: s.phone, city: s.city || null, user_id: mapUser(s.userId), created_at: s.createdAt })),
  );
  await insert(
    "leads",
    db.leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      city: l.city || null,
      course_id: l.courseId,
      source: l.source,
      stage: l.stage,
      owner_id: mapUser(l.ownerId),
      interview_at: l.interviewAt || null,
      follow_up_on: l.followUpOn || null,
      created_at: l.createdAt,
      updated_at: l.updatedAt,
      student_id: l.studentId || null,
      batch_id: l.batchId || null,
      rejection_reason: l.rejectionReason || null,
    })),
  );
  for (const s of db.students.filter((x) => x.leadId)) {
    const { error } = await sb.from("students").update({ lead_id: s.leadId }).eq("id", s.id);
    if (error) throw new Error(`students.lead_id: ${error.message}`);
  }
  await insert("lead_activity", db.leads.flatMap((l) => l.activity.map((a) => ({ lead_id: l.id, at: a.at, by_name: a.by, kind: a.kind, text: a.text }))));
  await insert(
    "enrolments",
    db.enrolments.map((e) => ({ id: e.id, student_id: e.studentId, batch_id: e.batchId, enrolled_at: e.enrolledAt, status: e.status, fee_paid: e.feePaid, transferred_to: e.transferredTo || null })),
  );
  await insert(
    "attendance",
    db.attendance.map((a) => ({ id: a.id, lecture_id: a.lectureId, student_id: a.studentId, joined_at: a.joinedAt || null, verification: a.verification, verified_by: a.verifiedBy || null, verified_at: a.verifiedAt || null })),
  );
  await insert(
    "recordings",
    db.recordings.map((r) => ({
      id: r.id,
      lecture_id: r.lectureId,
      batch_id: r.batchId,
      title: r.title,
      duration_mins: r.durationMins,
      file_name: r.fileName,
      size_mb: r.sizeMb,
      status: r.status,
      uploaded_at: r.uploadedAt,
      ready_at: r.readyAt,
      uploaded_by: mapUser(r.uploadedBy),
      published: r.published,
      views: r.views,
    })),
  );
  await insert(
    "invitations",
    db.users.filter((u) => u.status === "invited").map((u) => ({ email: u.email, name: u.name, role: u.role, token: u.activationToken })),
  );
  const s = db.settings;
  const { error } = await sb
    .from("org_settings")
    .update({ org_name: s.orgName, default_time_zone: s.defaultTimeZone, join_opens_minutes_before: s.joinOpensMinutesBefore, auto_publish_recordings: s.autoPublishRecordings, link_reminder_hours: s.linkReminderHours, support_email: s.supportEmail })
    .eq("id", 1);
  if (error) throw new Error(`org_settings: ${error.message}`);

  console.log(`\nDone. Sign in with any demo account, password ${DEMO_PASSWORD}:`);
  for (const u of active) console.log(`  ${u.role.padEnd(16)} ${u.email}`);
  console.log("  invited staff     /activate?token=welcome-deepak");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
