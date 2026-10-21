-- Batch LMS schema.
-- Product model: Course (curriculum) → Batch (one scheduled delivery) → Lecture (one live session) → Recording.
-- Lead (admissions pipeline) → Student (enrols in a batch, not a course).
-- Row-level security is the access control: the Sidebar only hides screens; Postgres decides what each role can read and write.

-- ============================================================ types & helpers

create type public.app_role as enum ('super-admin', 'operations', 'course-designer', 'admissions', 'student');

create or replace function public.gen_id(prefix text) returns text
language sql volatile as $$
  select prefix || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ============================================================ tables

create table public.org_settings (
  id smallint primary key default 1 check (id = 1),
  org_name text not null default 'Batch LMS',
  default_time_zone text not null default 'Asia/Kolkata',
  join_opens_minutes_before int not null default 0 check (join_opens_minutes_before between 0 and 60),
  auto_publish_recordings boolean not null default false,
  link_reminder_hours int not null default 24 check (link_reminder_hours between 1 and 168),
  support_email text not null default 'support@example.in'
);
insert into public.org_settings default values;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role public.app_role not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  time_zone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

create table public.courses (
  id text primary key default public.gen_id('crs'),
  code text not null unique check (code ~ '^[A-Z0-9]{2,6}$'),
  title text not null check (length(trim(title)) > 0),
  summary text not null default '',
  level text not null check (level in ('Beginner', 'Intermediate', 'Advanced')),
  duration_weeks int not null check (duration_weeks > 0),
  fee int not null check (fee >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  materials_enabled boolean not null default true,
  designer_id uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.course_modules (
  id text primary key default public.gen_id('mod'),
  course_id text not null references public.courses (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  position int not null default 0
);
create index on public.course_modules (course_id, position);

create table public.lecture_templates (
  id text primary key default public.gen_id('tpl'),
  module_id text not null references public.course_modules (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  duration_mins int not null default 90 check (duration_mins > 0),
  summary text,
  position int not null default 0
);
create index on public.lecture_templates (module_id, position);

create table public.materials (
  id text primary key default public.gen_id('mat'),
  course_id text not null references public.courses (id) on delete cascade,
  module_id text references public.course_modules (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  kind text not null check (kind in ('notes', 'slides', 'pdf', 'link')),
  body text,
  url text,
  file_name text,
  file_path text,
  size_kb int,
  updated_at timestamptz not null default now()
);
create index on public.materials (course_id);

create table public.batches (
  id text primary key default public.gen_id('bat'),
  code text not null unique,
  name text not null,
  course_id text not null references public.courses (id) on delete restrict,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  capacity int not null check (capacity > 0),
  instructors text[] not null default '{}',
  time_zone text not null default 'Asia/Kolkata',
  days text[] not null default '{}',
  slot_start text not null check (slot_start ~ '^\d{2}:\d{2}$'),
  slot_end text not null check (slot_end ~ '^\d{2}:\d{2}$'),
  lifecycle text not null default 'active' check (lifecycle in ('draft', 'active', 'cancelled')),
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.batches (course_id);

create table public.lectures (
  id text primary key default public.gen_id('lec'),
  batch_id text not null references public.batches (id) on delete cascade,
  number int not null check (number > 0),
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  time_zone text not null default 'Asia/Kolkata',
  instructor text,
  status text not null default 'scheduled' check (status in ('scheduled', 'rescheduled', 'cancelled')),
  previous_start timestamptz,
  agenda text,
  check (end_at > start_at)
);
create index on public.lectures (batch_id, start_at);
create index on public.lectures (start_at);

-- Meeting links live apart from lectures so students can only read a link once it's published.
create table public.lecture_links (
  lecture_id text primary key references public.lectures (id) on delete cascade,
  meeting_url text not null check (meeting_url ~ '^https://\S+$'),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.recordings (
  id text primary key default public.gen_id('rec'),
  lecture_id text not null unique references public.lectures (id) on delete cascade,
  batch_id text not null references public.batches (id) on delete cascade,
  title text not null,
  duration_mins int not null check (duration_mins > 0),
  file_name text not null,
  file_path text,
  size_mb numeric not null default 0,
  status text not null default 'ready' check (status in ('processing', 'ready')),
  uploaded_at timestamptz not null default now(),
  ready_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles (id) on delete set null,
  published boolean not null default false,
  views int not null default 0
);
create index on public.recordings (batch_id);

create table public.students (
  id text primary key default public.gen_id('stu'),
  name text not null,
  email text not null,
  phone text not null default '',
  city text,
  lead_id text,
  user_id uuid unique references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index students_email_key on public.students (lower(email));

create table public.leads (
  id text primary key default public.gen_id('lead'),
  name text not null,
  email text not null,
  phone text not null,
  city text,
  course_id text not null references public.courses (id) on delete restrict,
  source text not null check (source in ('Website', 'Instagram', 'Referral', 'Google Ads', 'WhatsApp', 'Walk-in', 'Webinar')),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'interview-scheduled', 'interviewed', 'selected', 'rejected', 'enrolled')),
  owner_id uuid references public.profiles (id) on delete set null,
  interview_at timestamptz,
  follow_up_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  student_id text references public.students (id) on delete set null,
  batch_id text references public.batches (id) on delete set null,
  rejection_reason text
);
create index on public.leads (stage);
create index on public.leads (owner_id);
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();

alter table public.students add constraint students_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete set null;

create table public.lead_activity (
  id text primary key default public.gen_id('act'),
  lead_id text not null references public.leads (id) on delete cascade,
  at timestamptz not null default now(),
  by_name text not null default 'System',
  kind text not null check (kind in ('note', 'call', 'stage', 'follow-up', 'interview', 'enrolment')),
  text text not null
);
create index on public.lead_activity (lead_id, at desc);

create table public.enrolments (
  id text primary key default public.gen_id('enr'),
  student_id text not null references public.students (id) on delete cascade,
  batch_id text not null references public.batches (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'completed', 'dropped', 'transferred')),
  fee_paid int not null default 0 check (fee_paid >= 0),
  transferred_to text references public.batches (id) on delete set null
);
create unique index enrolments_one_active on public.enrolments (student_id, batch_id) where status = 'active';
create index on public.enrolments (batch_id);

-- Joined ≠ attended. A Join click sets joined_at; only verification = 'present' counts.
create table public.attendance (
  id text primary key default public.gen_id('att'),
  lecture_id text not null references public.lectures (id) on delete cascade,
  student_id text not null references public.students (id) on delete cascade,
  joined_at timestamptz,
  verification text not null default 'unverified' check (verification in ('unverified', 'present', 'absent')),
  verified_by text check (verified_by in ('provider', 'operations')),
  verified_at timestamptz,
  unique (lecture_id, student_id)
);
create index on public.attendance (student_id);

-- Account invites. Accepting one creates the auth user (server, secret key) and the profile.
create table public.invitations (
  id text primary key default public.gen_id('inv'),
  email text not null,
  name text not null,
  role public.app_role not null,
  student_id text references public.students (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index invitations_open_email on public.invitations (lower(email)) where accepted_at is null;

-- ============================================================ access helpers (used by policies)

create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.has_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid() and status = 'active') = any (roles), false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid() and status = 'active') <> 'student', false)
$$;

create or replace function public.my_student_id() returns text
language sql stable security definer set search_path = public as $$
  select s.id from students s join profiles p on p.id = s.user_id where s.user_id = auth.uid() and p.status = 'active'
$$;

-- Batches the signed-in student belongs to (active or completed enrolments).
create or replace function public.my_batch_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select batch_id from enrolments where student_id = public.my_student_id() and status in ('active', 'completed')
$$;

create or replace function public.my_course_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct b.course_id from batches b where b.id in (select public.my_batch_ids())
$$;

create or replace function public._require_role(variadic roles public.app_role[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(variadic roles) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
end $$;

-- ============================================================ row-level security

alter table public.org_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lecture_templates enable row level security;
alter table public.materials enable row level security;
alter table public.batches enable row level security;
alter table public.lectures enable row level security;
alter table public.lecture_links enable row level security;
alter table public.recordings enable row level security;
alter table public.students enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activity enable row level security;
alter table public.enrolments enable row level security;
alter table public.attendance enable row level security;
alter table public.invitations enable row level security;

-- Settings: everyone signed in reads; Super Admin changes.
create policy settings_read on public.org_settings for select to authenticated using (true);
create policy settings_write on public.org_settings for update to authenticated using ((select public.has_role('super-admin')));

-- Profiles: staff see everyone; a student sees only themselves. Updates are guarded by a trigger below.
create policy profiles_read on public.profiles for select to authenticated
  using ((select public.is_staff()) or id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.has_role('super-admin')));

-- Curriculum: staff read all; students read the courses of their batches. Course Designer + Super Admin write.
create policy courses_read on public.courses for select to authenticated
  using ((select public.is_staff()) or id in (select public.my_course_ids()));
create policy courses_write on public.courses for all to authenticated
  using ((select public.has_role('super-admin', 'course-designer')))
  with check ((select public.has_role('super-admin', 'course-designer')));

create policy modules_read on public.course_modules for select to authenticated
  using ((select public.is_staff()) or course_id in (select public.my_course_ids()));
create policy modules_write on public.course_modules for all to authenticated
  using ((select public.has_role('super-admin', 'course-designer')))
  with check ((select public.has_role('super-admin', 'course-designer')));

create policy templates_read on public.lecture_templates for select to authenticated
  using ((select public.is_staff()) or module_id in (select id from public.course_modules where course_id in (select public.my_course_ids())));
create policy templates_write on public.lecture_templates for all to authenticated
  using ((select public.has_role('super-admin', 'course-designer')))
  with check ((select public.has_role('super-admin', 'course-designer')));

-- Materials: students only when the course has materials switched on.
create policy materials_read on public.materials for select to authenticated
  using (
    (select public.is_staff())
    or (course_id in (select public.my_course_ids()) and exists (select 1 from public.courses c where c.id = course_id and c.materials_enabled))
  );
create policy materials_write on public.materials for all to authenticated
  using ((select public.has_role('super-admin', 'course-designer')))
  with check ((select public.has_role('super-admin', 'course-designer')));

-- Delivery: Operations + Super Admin write batches, lectures, links and recordings.
create policy batches_read on public.batches for select to authenticated
  using ((select public.is_staff()) or id in (select public.my_batch_ids()));
create policy batches_write on public.batches for all to authenticated
  using ((select public.has_role('super-admin', 'operations')))
  with check ((select public.has_role('super-admin', 'operations')));

create policy lectures_read on public.lectures for select to authenticated
  using ((select public.is_staff()) or batch_id in (select public.my_batch_ids()));
create policy lectures_write on public.lectures for all to authenticated
  using ((select public.has_role('super-admin', 'operations')))
  with check ((select public.has_role('super-admin', 'operations')));

create policy links_read on public.lecture_links for select to authenticated
  using (
    (select public.is_staff())
    or (published and lecture_id in (select id from public.lectures where batch_id in (select public.my_batch_ids())))
  );
create policy links_write on public.lecture_links for all to authenticated
  using ((select public.has_role('super-admin', 'operations')))
  with check ((select public.has_role('super-admin', 'operations')));

create policy recordings_read on public.recordings for select to authenticated
  using ((select public.is_staff()) or (published and status = 'ready' and batch_id in (select public.my_batch_ids())));
create policy recordings_write on public.recordings for all to authenticated
  using ((select public.has_role('super-admin', 'operations')))
  with check ((select public.has_role('super-admin', 'operations')));

-- People: Admissions, Operations and Super Admin manage leads, students and enrolments.
create policy students_read on public.students for select to authenticated
  using ((select public.is_staff()) or user_id = (select auth.uid()));
create policy students_write on public.students for all to authenticated
  using ((select public.has_role('super-admin', 'operations', 'admissions')))
  with check ((select public.has_role('super-admin', 'operations', 'admissions')));

create policy leads_all on public.leads for all to authenticated
  using ((select public.has_role('super-admin', 'operations', 'admissions')))
  with check ((select public.has_role('super-admin', 'operations', 'admissions')));
create policy lead_activity_all on public.lead_activity for all to authenticated
  using ((select public.has_role('super-admin', 'operations', 'admissions')))
  with check ((select public.has_role('super-admin', 'operations', 'admissions')));

create policy enrolments_read on public.enrolments for select to authenticated
  using ((select public.is_staff()) or student_id = (select public.my_student_id()));
create policy enrolments_write on public.enrolments for all to authenticated
  using ((select public.has_role('super-admin', 'operations', 'admissions')))
  with check ((select public.has_role('super-admin', 'operations', 'admissions')));

-- Attendance: Operations verifies. Students record a Join only through record_join().
create policy attendance_read on public.attendance for select to authenticated
  using ((select public.is_staff()) or student_id = (select public.my_student_id()));
create policy attendance_write on public.attendance for all to authenticated
  using ((select public.has_role('super-admin', 'operations')))
  with check ((select public.has_role('super-admin', 'operations')));

-- Invitations: Super Admin manages all; Operations and Admissions see student invites they need to share.
create policy invitations_read on public.invitations for select to authenticated
  using ((select public.has_role('super-admin')) or (role = 'student' and (select public.has_role('operations', 'admissions'))));
create policy invitations_insert on public.invitations for insert to authenticated
  with check ((select public.has_role('super-admin')) or (role = 'student' and (select public.has_role('operations', 'admissions'))));
create policy invitations_delete on public.invitations for delete to authenticated
  using ((select public.has_role('super-admin')) or (role = 'student' and (select public.has_role('operations', 'admissions'))));

-- Nobody but a Super Admin changes roles, status or email; keep at least one active Super Admin.
create or replace function public._guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- server (secret key) and migrations
  end if;
  if (new.role is distinct from old.role or new.status is distinct from old.status or new.email is distinct from old.email)
     and not public.has_role('super-admin') then
    raise exception 'Only a Super Admin can change roles or account status.' using errcode = '42501';
  end if;
  if old.role = 'super-admin' and old.status = 'active' and (new.role <> 'super-admin' or new.status <> 'active')
     and (select count(*) from profiles where role = 'super-admin' and status = 'active') <= 1 then
    raise exception 'Keep at least one active Super Admin.';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public._guard_profile_update();

-- ============================================================ storage

insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false), ('materials', 'materials', false)
on conflict (id) do nothing;

create policy "recordings: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and public.has_role('super-admin', 'operations'));
create policy "recordings: staff change" on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and public.has_role('super-admin', 'operations'));
create policy "recordings: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and public.has_role('super-admin', 'operations'));
create policy "recordings: read" on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings'
    and (public.is_staff() or exists (select 1 from public.recordings r where r.file_path = objects.name))
  );

create policy "materials: designers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and public.has_role('super-admin', 'course-designer'));
create policy "materials: designers change" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and public.has_role('super-admin', 'course-designer'));
create policy "materials: designers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and public.has_role('super-admin', 'course-designer'));
create policy "materials: read" on storage.objects for select to authenticated
  using (
    bucket_id = 'materials'
    and (public.is_staff() or exists (select 1 from public.materials m where m.file_path = objects.name))
  );

-- ============================================================ operations that must be atomic

-- Seat-checked enrolment. Locks the batch row so two people can't take the last seat.
create or replace function public._enrol(p_student_id text, p_batch_id text, p_fee int) returns public.enrolments
language plpgsql security definer set search_path = public as $$
declare
  b batches;
  filled int;
  e enrolments;
begin
  select * into b from batches where id = p_batch_id for update;
  if not found then
    raise exception 'That batch no longer exists.';
  end if;
  if b.lifecycle <> 'active' then
    raise exception '% isn''t open for enrolment.', b.name;
  end if;
  if b.end_date < (now() at time zone b.time_zone)::date then
    raise exception '% has already finished.', b.name;
  end if;
  select count(*) into filled from enrolments where batch_id = p_batch_id and status in ('active', 'completed');
  if filled >= b.capacity then
    raise exception '% is full (% of % seats filled).', b.name, b.capacity, b.capacity;
  end if;
  if exists (select 1 from enrolments where student_id = p_student_id and batch_id = p_batch_id and status = 'active') then
    raise exception 'Already enrolled in this batch.';
  end if;
  insert into enrolments (student_id, batch_id, fee_paid) values (p_student_id, p_batch_id, greatest(coalesce(p_fee, 0), 0)) returning * into e;
  return e;
end $$;

-- Open invitation for a student without an account; returns its token (or null if they have one).
create or replace function public._ensure_student_invitation(p_student_id text) returns text
language plpgsql security definer set search_path = public as $$
declare
  s students;
  t text;
begin
  select * into s from students where id = p_student_id;
  if s.user_id is not null then
    return null;
  end if;
  select token into t from invitations where student_id = p_student_id and accepted_at is null limit 1;
  if t is null then
    delete from invitations where lower(email) = lower(s.email) and accepted_at is null;
    insert into invitations (email, name, role, student_id, invited_by)
    values (s.email, s.name, 'student', s.id, auth.uid()) returning token into t;
  end if;
  return t;
end $$;

create or replace function public._actor_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select name from profiles where id = auth.uid()), 'System')
$$;

-- Selected lead → student enrolled in a batch.
create or replace function public.enrol_lead(p_lead_id text, p_batch_id text, p_fee int) returns json
language plpgsql security definer set search_path = public as $$
declare
  l leads;
  s students;
  e enrolments;
  b batches;
  t text;
begin
  perform public._require_role('super-admin', 'operations', 'admissions');
  select * into l from leads where id = p_lead_id for update;
  if not found then
    raise exception 'That lead no longer exists.';
  end if;
  if l.stage = 'enrolled' then
    raise exception '% is already enrolled.', l.name;
  end if;
  select * into s from students where lower(email) = lower(l.email);
  if not found then
    insert into students (name, email, phone, city, lead_id) values (l.name, lower(l.email), l.phone, l.city, l.id) returning * into s;
  end if;
  e := public._enrol(s.id, p_batch_id, p_fee);
  t := public._ensure_student_invitation(s.id);
  select * into b from batches where id = p_batch_id;
  update leads set stage = 'enrolled', student_id = s.id, batch_id = p_batch_id, follow_up_on = null where id = p_lead_id;
  insert into lead_activity (lead_id, by_name, kind, text) values (p_lead_id, public._actor_name(), 'enrolment', 'Enrolled in ' || b.name);
  return json_build_object('student_id', s.id, 'enrolment_id', e.id, 'token', t);
end $$;

-- Walk-in student, optionally enrolled straight away.
create or replace function public.add_student(p_name text, p_email text, p_phone text, p_city text, p_batch_id text, p_fee int) returns json
language plpgsql security definer set search_path = public as $$
declare
  s students;
  e enrolments;
  t text;
begin
  perform public._require_role('super-admin', 'operations', 'admissions');
  if exists (select 1 from students where lower(email) = lower(trim(p_email))) then
    raise exception 'A student with this email already exists. Open their profile to enrol them.';
  end if;
  insert into students (name, email, phone, city) values (trim(p_name), lower(trim(p_email)), trim(p_phone), nullif(trim(coalesce(p_city, '')), '')) returning * into s;
  if p_batch_id is not null then
    e := public._enrol(s.id, p_batch_id, p_fee);
  end if;
  t := public._ensure_student_invitation(s.id);
  return json_build_object('student_id', s.id, 'enrolment_id', e.id, 'token', t);
end $$;

create or replace function public.enrol_student(p_student_id text, p_batch_id text, p_fee int) returns json
language plpgsql security definer set search_path = public as $$
declare
  e enrolments;
begin
  perform public._require_role('super-admin', 'operations', 'admissions');
  e := public._enrol(p_student_id, p_batch_id, p_fee);
  return json_build_object('enrolment_id', e.id);
end $$;

-- Moves an active enrolment to another batch. Attendance history stays with the old batch.
create or replace function public.transfer_student(p_enrolment_id text, p_to_batch_id text) returns json
language plpgsql security definer set search_path = public as $$
declare
  old_e enrolments;
  new_e enrolments;
begin
  perform public._require_role('super-admin', 'operations', 'admissions');
  select * into old_e from enrolments where id = p_enrolment_id for update;
  if not found then
    raise exception 'That enrolment no longer exists.';
  end if;
  if old_e.status <> 'active' then
    raise exception 'Only an active enrolment can be transferred.';
  end if;
  if old_e.batch_id = p_to_batch_id then
    raise exception 'Choose a different batch.';
  end if;
  new_e := public._enrol(old_e.student_id, p_to_batch_id, old_e.fee_paid);
  update enrolments set status = 'transferred', transferred_to = p_to_batch_id where id = p_enrolment_id;
  return json_build_object('enrolment_id', new_e.id, 'from_enrolment_id', old_e.id);
end $$;

-- (Re)issue a student's account invite. Returns the token.
create or replace function public.invite_student(p_student_id text) returns text
language plpgsql security definer set search_path = public as $$
declare
  s students;
begin
  perform public._require_role('super-admin', 'operations', 'admissions');
  select * into s from students where id = p_student_id;
  if not found then
    raise exception 'That student no longer exists.';
  end if;
  if s.user_id is not null then
    raise exception '% has already activated their account.', s.name;
  end if;
  delete from invitations where student_id = p_student_id and accepted_at is null;
  return public._ensure_student_invitation(p_student_id);
end $$;

-- A Join click by the signed-in student. Records "joined", which is not attendance.
create or replace function public.record_join(p_lecture_id text) returns json
language plpgsql security definer set search_path = public as $$
declare
  sid text := public.my_student_id();
  l lectures;
  opens interval;
  a attendance;
begin
  if sid is null then
    raise exception 'Only students can join a class.' using errcode = '42501';
  end if;
  select * into l from lectures where id = p_lecture_id;
  if not found or l.status = 'cancelled' then
    raise exception 'This lecture isn''t running.';
  end if;
  if not exists (select 1 from enrolments where student_id = sid and batch_id = l.batch_id and status = 'active') then
    raise exception 'Only students in this batch can join.' using errcode = '42501';
  end if;
  if not exists (select 1 from lecture_links where lecture_id = l.id and published) then
    raise exception 'The meeting link hasn''t been published yet.';
  end if;
  select make_interval(mins => join_opens_minutes_before) into opens from org_settings where id = 1;
  if now() < l.start_at - opens or now() >= l.end_at then
    raise exception 'Join is only open while the class is on.';
  end if;
  insert into attendance (lecture_id, student_id, joined_at) values (l.id, sid, now())
  on conflict (lecture_id, student_id) do update set joined_at = coalesce(attendance.joined_at, excluded.joined_at)
  returning * into a;
  return row_to_json(a);
end $$;

create or replace function public.record_view(p_recording_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_staff() or exists (
    select 1 from recordings r where r.id = p_recording_id and r.published and r.status = 'ready' and r.batch_id in (select public.my_batch_ids())
  )) then
    raise exception 'You don''t have access to this recording.' using errcode = '42501';
  end if;
  update recordings set views = views + 1 where id = p_recording_id;
end $$;

-- The meeting provider's participant report: students it saw are present, everyone else absent.
-- Corrections Operations already made are kept.
create or replace function public.import_provider_attendance(p_lecture_id text) returns json
language plpgsql security definer set search_path = public as $$
declare
  l lectures;
  present int := 0;
  absent int := 0;
  r record;
begin
  perform public._require_role('super-admin', 'operations');
  select * into l from lectures where id = p_lecture_id;
  if not found then
    raise exception 'That lecture no longer exists.';
  end if;
  if l.end_at > now() then
    raise exception 'The provider report is available after the lecture ends.';
  end if;
  for r in
    select e.student_id, a.joined_at, a.verified_by, a.verification
    from enrolments e
    left join attendance a on a.lecture_id = l.id and a.student_id = e.student_id
    where e.batch_id = l.batch_id and e.status in ('active', 'completed')
  loop
    if r.verified_by = 'operations' then
      if r.verification = 'present' then present := present + 1; elsif r.verification = 'absent' then absent := absent + 1; end if;
      continue;
    end if;
    insert into attendance (lecture_id, student_id, verification, verified_by, verified_at)
    values (l.id, r.student_id, case when r.joined_at is not null then 'present' else 'absent' end, 'provider', now())
    on conflict (lecture_id, student_id) do update
      set verification = excluded.verification, verified_by = 'provider', verified_at = now();
    if r.joined_at is not null then present := present + 1; else absent := absent + 1; end if;
  end loop;
  return json_build_object('present', present, 'absent', absent);
end $$;

-- Activation page: who is this invite for? Callable before sign-in.
create or replace function public.get_invitation(p_token text) returns table (name text, email text, role public.app_role)
language sql stable security definer set search_path = public as $$
  select name, email, role from invitations where token = p_token and accepted_at is null
$$;

-- Called by the server (secret key) after it creates the auth user for an invite.
create or replace function public.accept_invitation(p_token text, p_user_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  i invitations;
  tz text;
begin
  select * into i from invitations where token = p_token and accepted_at is null for update;
  if not found then
    raise exception 'This activation link has expired or was already used. Ask your administrator for a new one.';
  end if;
  select default_time_zone into tz from org_settings where id = 1;
  insert into profiles (id, name, email, role, time_zone) values (p_user_id, i.name, lower(i.email), i.role, coalesce(tz, 'Asia/Kolkata'))
  on conflict (id) do update set name = excluded.name, role = excluded.role, status = 'active';
  if i.student_id is not null then
    update students set user_id = p_user_id where id = i.student_id;
  end if;
  update invitations set accepted_at = now() where id = i.id;
  return json_build_object('role', i.role, 'email', i.email);
end $$;

revoke execute on function public._enrol(text, text, int) from public, anon, authenticated;
revoke execute on function public._ensure_student_invitation(text) from public, anon, authenticated;
revoke execute on function public.accept_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_invitation(text, uuid) to service_role;
revoke execute on function public.enrol_lead(text, text, int) from public, anon;
revoke execute on function public.add_student(text, text, text, text, text, int) from public, anon;
revoke execute on function public.enrol_student(text, text, int) from public, anon;
revoke execute on function public.transfer_student(text, text) from public, anon;
revoke execute on function public.invite_student(text) from public, anon;
revoke execute on function public.record_join(text) from public, anon;
revoke execute on function public.record_view(text) from public, anon;
revoke execute on function public.import_provider_attendance(text) from public, anon;
grant execute on function public.get_invitation(text) to anon, authenticated;
