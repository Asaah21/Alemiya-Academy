-- T02 / migration 1: school setup tables
-- Every table has created_by and created_at so each record shows who entered it and when.

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),   -- only one row allowed
  school_name text not null default '',
  location text,
  district text,
  region text,
  circuit text,
  logo_url text,
  next_term_opening_date date,
  class_score_max numeric(5,2) not null default 30 check (class_score_max > 0),  -- open question Q1
  exam_score_max numeric(5,2) not null default 70 check (exam_score_max > 0),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                      -- for example 2025/2026
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);
create unique index one_current_academic_year on public.academic_years (is_current) where is_current;

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id),
  name text not null check (name in ('Term 1', 'Term 2', 'Term 3')),
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  is_current boolean not null default false,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  unique (academic_year_id, name),
  check (end_date > start_date)
);
create unique index one_current_term on public.terms (is_current) where is_current;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                      -- Creche, Nursery 1, ... JHS 3
  level_order integer not null unique,            -- 1 = Creche ... 14 = JHS 3, used for promotion
  form_teacher_id uuid,                           -- foreign key added after staff exists
  scored boolean not null default true,           -- false = remarks-only report card (rule G8)
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('core', 'elective')),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.class_subjects (
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (class_id, subject_id)
);

create table public.grade_scale (
  id uuid primary key default gen_random_uuid(),
  min_score numeric(5,2) not null,
  max_score numeric(5,2) not null,
  grade text not null,
  remark text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  check (min_score >= 0 and max_score >= min_score),
  -- score ranges may not overlap (T06 acceptance check)
  exclude using gist (numrange(min_score, max_score, '[]') with &&)
);

-- Links a login to a role. Parents get a row too (role = 'parent').
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'staff', 'parent')),
  phone text,
  active boolean not null default true,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

-- Simple staff list (no HR fields in version 1)
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  subject_notes text,
  class_id uuid references public.classes (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.classes
  add constraint classes_form_teacher_fk
  foreign key (form_teacher_id) references public.staff (id) on delete set null;
