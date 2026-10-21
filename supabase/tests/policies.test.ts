/*
 * Runs every migration on PGlite (real Postgres, compiled to WebAssembly, no Docker) with small
 * stand-ins for Supabase's auth and storage schemas, then checks row-level security and the SQL
 * functions as each role. Tests share one database and run in order.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = fileURLToPath(new URL("../migrations/", import.meta.url));

const U = {
  admin: "00000000-0000-0000-0000-000000000001",
  ops: "00000000-0000-0000-0000-000000000002",
  adm: "00000000-0000-0000-0000-000000000003",
  cd: "00000000-0000-0000-0000-000000000004",
  stu: "00000000-0000-0000-0000-000000000005",
  stu2: "00000000-0000-0000-0000-000000000006",
};

let db: PGlite;

/** Runs SQL as a signed-in user (role "authenticated", auth.uid() = uid), like a Supabase API call. */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, role = "authenticated"): Promise<T[]> {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid || ""}', false);`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function errorAs(uid: string | null, sql: string, role = "authenticated"): Promise<string> {
  try {
    await as(uid, sql, role);
  } catch (e) {
    return (e as Error).message;
  }
  return "no error";
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema extensions; create extension pgcrypto schema extensions;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    set search_path = public, extensions;
  `);
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(MIGRATIONS + f, "utf8"));
  }
  await db.exec(`
    insert into auth.users (id, email) values
      ('${U.admin}','kavya@example.in'),('${U.ops}','anjali@example.in'),('${U.adm}','meera@example.in'),
      ('${U.cd}','lakshmi@example.in'),('${U.stu}','priya@example.in'),('${U.stu2}','other@example.in');
    insert into profiles (id, name, email, role) values
      ('${U.admin}','Kavya Menon','kavya@example.in','super-admin'),('${U.ops}','Anjali Rao','anjali@example.in','operations'),
      ('${U.adm}','Meera Nair','meera@example.in','admissions'),('${U.cd}','Lakshmi Pillai','lakshmi@example.in','course-designer'),
      ('${U.stu}','Priya Sharma','priya@example.in','student'),('${U.stu2}','Other Student','other@example.in','student');
    insert into courses (id, code, title, level, duration_weeks, fee, status, materials_enabled) values
      ('crs-a','FSW','Full-Stack Web','Intermediate',9,85000,'published',true),
      ('crs-b','UXD','UI/UX Design','Beginner',6,48000,'published',false);
    insert into course_modules (id, course_id, title) values ('mod-a','crs-a','Back-end'),('mod-b','crs-b','Research');
    insert into materials (id, course_id, title, kind, body, file_path) values
      ('mat-a','crs-a','Notes','notes','x','crs-a/notes.pdf'),('mat-b','crs-b','Guide','pdf',null,'crs-b/guide.pdf');
    insert into batches (id, code, name, course_id, start_date, end_date, capacity, days, slot_start, slot_end) values
      ('bat-a','FSW-07','Full-Stack Web · Batch 07','crs-a', current_date - 30, current_date + 30, 2, '{Mon}', '18:30','20:00'),
      ('bat-b','UXD-02','UI/UX Design · Batch 02','crs-b', current_date - 30, current_date + 30, 30, '{Mon}', '14:00','15:30'),
      ('bat-c','FSW-08','Full-Stack Web · Batch 08','crs-a', current_date + 10, current_date + 60, 30, '{Tue}', '19:00','20:30');
    insert into lectures (id, batch_id, number, title, start_at, end_at) values
      ('lec-live','bat-a',13,'Live now', now() - interval '20 min', now() + interval '70 min'),
      ('lec-past','bat-a',12,'Ended', now() - interval '2 days', now() - interval '2 days' + interval '90 min'),
      ('lec-next','bat-a',14,'Next', now() + interval '2 days', now() + interval '2 days 90 min'),
      ('lec-b','bat-b',9,'Other batch live', now() - interval '10 min', now() + interval '80 min');
    insert into lecture_links (lecture_id, meeting_url, published) values
      ('lec-live','https://meet.example.com/a13',true),('lec-next','https://meet.example.com/a14',false),('lec-b','https://meet.example.com/b9',true);
    insert into students (id, name, email, phone, user_id) values
      ('stu-1','Priya Sharma','priya@example.in','9848012345','${U.stu}'),
      ('stu-2','Arjun Mehta','arjun@example.in','9848012346',null),
      ('stu-3','Other Student','other@example.in','9848012347','${U.stu2}');
    insert into enrolments (id, student_id, batch_id) values ('enr-1','stu-1','bat-a'),('enr-3','stu-3','bat-b');
    insert into recordings (id, lecture_id, batch_id, title, duration_mins, file_name, file_path, published) values
      ('rec-past','lec-past','bat-a','Ended',88,'a.mp4','bat-a/lec-past/a.mp4',true);
    insert into storage.objects (bucket_id, name) values ('recordings','bat-a/lec-past/a.mp4'),('materials','crs-a/notes.pdf'),('materials','crs-b/guide.pdf');
    insert into leads (id, name, email, phone, course_id, source, stage) values
      ('lead-1','Neha Kulkarni','neha@example.in','9848000001','crs-a','Website','selected'),
      ('lead-2','Karan Nair','karan@example.in','9848000002','crs-a','Referral','selected');
  `);
});

describe("what each role can read", () => {
  it("staff see every lecture; a student only their batch's", async () => {
    expect(await as(U.ops, "select id from lectures")).toHaveLength(4);
    expect(await as(U.stu, "select id from lectures")).toHaveLength(3);
  });
  it("students see a meeting link only once it's published", async () => {
    expect(await as(U.stu, "select lecture_id from lecture_links")).toEqual([{ lecture_id: "lec-live" }]);
  });
  it("students can't see leads, other people or other students", async () => {
    expect(await as(U.stu, "select id from leads")).toHaveLength(0);
    expect(await as(U.stu, "select id from profiles")).toHaveLength(1);
    expect(await as(U.stu, "select id from students")).toHaveLength(1);
  });
  it("students see materials only for courses with materials on", async () => {
    expect(await as(U.stu, "select id from materials")).toHaveLength(1);
    expect(await as(U.stu2, "select id from materials")).toHaveLength(0);
    expect(await as(U.stu2, "select name from storage.objects where bucket_id = 'materials'")).toHaveLength(0);
  });
  it("recordings and their files are visible only to the batch", async () => {
    expect(await as(U.stu, "select id from recordings")).toHaveLength(1);
    expect(await as(U.stu2, "select id from recordings")).toHaveLength(0);
    expect(await as(U.stu, "select name from storage.objects where bucket_id = 'recordings'")).toHaveLength(1);
    expect(await as(U.stu2, "select name from storage.objects where bucket_id = 'recordings'")).toHaveLength(0);
  });
  it("leads are for Admissions, not Course Designers; signed-out visitors see nothing", async () => {
    expect(await as(U.adm, "select id from leads")).toHaveLength(2);
    expect(await as(U.cd, "select id from leads")).toHaveLength(0);
    expect(await as(null, "select id from courses", "anon")).toHaveLength(0);
  });
});

describe("what each role can change", () => {
  it("only Course Designers and Super Admins write courses", async () => {
    expect(await errorAs(U.adm, "insert into courses (code,title,level,duration_weeks,fee) values ('ZZ','x','Beginner',1,1)")).toMatch(/row-level security/);
    expect(await as(U.cd, "insert into courses (code,title,level,duration_weeks,fee) values ('ZZ','x','Beginner',1,1) returning id")).toHaveLength(1);
  });
  it("Course Designers can't create batches", async () => {
    expect(await errorAs(U.cd, "insert into batches (code,name,course_id,start_date,end_date,capacity,slot_start,slot_end) values ('X','x','crs-a',current_date,current_date,1,'10:00','11:00')")).toMatch(/row-level security/);
  });
  it("students can't write attendance directly", async () => {
    expect(await errorAs(U.stu, "insert into attendance (lecture_id, student_id, verification) values ('lec-past','stu-1','present')")).toMatch(/row-level security/);
  });
  it("only a Super Admin changes roles, and one active Super Admin always remains", async () => {
    expect(await errorAs(U.stu, `update profiles set role = 'super-admin' where id = '${U.stu}'`)).toMatch(/Only a Super Admin/);
    expect(await errorAs(U.ops, `update profiles set role = 'super-admin' where id = '${U.ops}'`)).toMatch(/Only a Super Admin/);
    expect(await errorAs(U.admin, `update profiles set role = 'operations' where id = '${U.admin}'`)).toMatch(/at least one active Super Admin/);
    expect(await as(U.stu, `update profiles set time_zone = 'Asia/Dubai' where id = '${U.stu}' returning id`)).toHaveLength(1);
  });
});

describe("joining a live class (joined ≠ attended)", () => {
  it("records a Join as joined and unverified", async () => {
    await as(U.stu, "select record_join('lec-live')");
    const [a] = (await db.query<{ joined_at: string; verification: string }>("select joined_at, verification from attendance where lecture_id = 'lec-live'")).rows;
    expect(a.joined_at).toBeTruthy();
    expect(a.verification).toBe("unverified");
  });
  it("refuses before the class, for another batch, and for staff", async () => {
    expect(await errorAs(U.stu, "select record_join('lec-next')")).toMatch(/only open while the class is on|hasn't been published/);
    expect(await errorAs(U.stu, "select record_join('lec-b')")).toMatch(/Only students in this batch/);
    expect(await errorAs(U.ops, "select record_join('lec-live')")).toMatch(/Only students/);
  });
});

describe("enrolment", () => {
  it("enrols a selected lead, linking the student and creating an account invite", async () => {
    const [{ r }] = await as<{ r: { token: string } }>(U.adm, "select enrol_lead('lead-1', 'bat-a', 85000) as r");
    expect(r.token).toBeTruthy();
    const [lead] = (await db.query<{ stage: string; student_id: string }>("select stage, student_id from leads where id = 'lead-1'")).rows;
    expect(lead.stage).toBe("enrolled");
    expect(lead.student_id).toBeTruthy();
  });
  it("never overfills a batch, and a refused enrolment changes nothing", async () => {
    expect(await errorAs(U.adm, "select enrol_lead('lead-2', 'bat-a', 85000)")).toMatch(/is full \(2 of 2 seats filled\)/);
    expect((await db.query<{ stage: string }>("select stage from leads where id = 'lead-2'")).rows[0].stage).toBe("selected");
  });
  it("checks roles and duplicates", async () => {
    expect(await errorAs(U.cd, "select enrol_student('stu-2', 'bat-c', 0)")).toMatch(/permission/);
    await as(U.ops, "select enrol_student('stu-2', 'bat-c', 1000)");
    expect(await errorAs(U.ops, "select enrol_student('stu-2', 'bat-c', 1000)")).toMatch(/Already enrolled/);
    expect(await errorAs(U.adm, "select add_student('Priya', 'PRIYA@example.in', '9848012345', null, null, 0)")).toMatch(/already exists/);
  });
  it("adds a walk-in student with an account invite", async () => {
    const [{ r }] = await as<{ r: { student_id: string; token: string } }>(U.adm, "select add_student('Sana Khan', 'sana@example.in', '9848012399', 'Pune', 'bat-b', 48000) as r");
    expect(r.student_id).toBeTruthy();
    expect(r.token).toBeTruthy();
  });
  it("transfers keep the old enrolment as history", async () => {
    await as(U.ops, "select transfer_student('enr-1', 'bat-c')");
    const [e] = (await db.query<{ status: string; transferred_to: string }>("select status, transferred_to from enrolments where id = 'enr-1'")).rows;
    expect(e).toEqual({ status: "transferred", transferred_to: "bat-c" });
  });
});

describe("attendance import", () => {
  it("marks students the provider saw as present and the rest absent, after the lecture only", async () => {
    await db.exec("insert into enrolments (id, student_id, batch_id) values ('enr-x', 'stu-1', 'bat-a')");
    await db.exec("insert into attendance (lecture_id, student_id, joined_at) values ('lec-past', 'stu-1', now() - interval '2 days')");
    expect(await errorAs(U.ops, "select import_provider_attendance('lec-live')")).toMatch(/after the lecture ends/);
    expect(await errorAs(U.adm, "select import_provider_attendance('lec-past')")).toMatch(/permission/);
    const [{ r }] = await as<{ r: { present: number; absent: number } }>(U.ops, "select import_provider_attendance('lec-past') as r");
    expect(r.present).toBe(1);
  });
});

describe("invitations", () => {
  it("can be looked up by token before sign-in, and accepted only by the server", async () => {
    const [{ token }] = (await db.query<{ token: string }>("select token from invitations where lower(email) = 'neha@example.in' and accepted_at is null")).rows;
    expect(await as(null, `select * from get_invitation('${token}')`, "anon")).toHaveLength(1);
    expect(await errorAs(U.stu, `select accept_invitation('${token}', '${U.stu}')`)).toMatch(/permission denied/);
    await db.exec(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000099', 'neha@example.in')`);
    await as(null, `select accept_invitation('${token}', '00000000-0000-0000-0000-000000000099')`, "service_role");
    const [p] = (await db.query<{ role: string }>("select p.role from profiles p join students s on s.user_id = p.id where p.email = 'neha@example.in'")).rows;
    expect(p.role).toBe("student");
    expect(await as(null, `select * from get_invitation('${token}')`, "anon")).toHaveLength(0);
  });
  it("Operations can invite students but not staff", async () => {
    expect(await as(U.ops, "select id from invitations where role = 'student' and accepted_at is null")).toHaveLength(1);
    expect(await errorAs(U.ops, "insert into invitations (email, name, role) values ('x@example.in', 'X', 'super-admin')")).toMatch(/row-level security/);
  });
});

describe("recording views", () => {
  it("count only for people who can watch", async () => {
    await as(U.stu, "select record_view('rec-past')");
    expect(await errorAs(U.stu2, "select record_view('rec-past')")).toMatch(/access/);
  });
});
