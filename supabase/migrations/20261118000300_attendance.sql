-- T02 / migration 3: student weekly attendance, staff daily attendance, non-school days

create table public.attendance_weeks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id),
  term_id uuid not null references public.terms (id),
  week_start date not null check (extract(isodow from week_start) = 1),   -- must be a Monday
  school_days integer not null default 5 check (school_days between 0 and 7),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  unique (class_id, week_start)
);

-- Only days absent is stored; days present is calculated (rules A2, A5)
create table public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.attendance_weeks (id),
  student_id uuid not null references public.students (id),
  days_absent integer not null default 0 check (days_absent >= 0),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  unique (week_id, student_id)
);
create index attendance_entries_student_idx on public.attendance_entries (student_id);

-- Rule A4: days absent can never be more than school days
create function public.check_days_absent() returns trigger
language plpgsql as $$
declare
  v_school_days integer;
begin
  select school_days into v_school_days from public.attendance_weeks where id = new.week_id;
  if new.days_absent > v_school_days then
    raise exception 'Days absent (%) cannot be more than school days (%)', new.days_absent, v_school_days;
  end if;
  return new;
end $$;

create trigger attendance_entries_check_days
before insert or update on public.attendance_entries
for each row execute function public.check_days_absent();

-- Lowering school days later must not leave entries above the new limit
create function public.check_school_days() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.attendance_entries
    where week_id = new.id and days_absent > new.school_days
  ) then
    raise exception 'Some students already have more days absent than %', new.school_days;
  end if;
  return new;
end $$;

create trigger attendance_weeks_check_school_days
before update of school_days on public.attendance_weeks
for each row execute function public.check_school_days();

-- Staff attendance: one row per staff member per school day, Admin only (rules ST1 to ST5)
create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  attendance_date date not null,
  term_id uuid not null references public.terms (id),
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'on_leave')),
  note text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  unique (staff_id, attendance_date)
);
create index staff_attendance_date_idx on public.staff_attendance (attendance_date);

-- Holidays and closures, left out of staff attendance rates (rule ST4)
create table public.non_school_days (
  id uuid primary key default gen_random_uuid(),
  non_school_date date not null unique,
  term_id uuid references public.terms (id),
  reason text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
