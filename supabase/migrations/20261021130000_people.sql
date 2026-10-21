-- People: keep a student's record in step when they change their own mobile number.
-- Students can update their own profile but not the students table (staff manage it), so the
-- profile's phone is copied across by this trigger.

create or replace function public._sync_student_phone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.phone is distinct from old.phone and new.phone is not null then
    update students set phone = new.phone where user_id = new.id;
  end if;
  return new;
end $$;

create trigger profiles_sync_student_phone
  after update of phone on public.profiles
  for each row execute function public._sync_student_phone();
