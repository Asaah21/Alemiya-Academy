-- T02 / migration 2: students, movement history, parent access

create table public.students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,              -- for example ALM-2026-001 (rule S1), generated in T07
  full_name text not null,
  gender text not null check (gender in ('male', 'female')),
  date_of_birth date,
  class_id uuid references public.classes (id),
  guardian_name text,
  guardian_phone text,
  status text not null default 'active'
    check (status in ('active', 'transferred_out', 'withdrawn', 'graduated')),
  admitted_on date,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
create index students_class_idx on public.students (class_id);
create index students_status_idx on public.students (status);

-- One row per change of status or class. Basis of enrolment turnover (rules S2 to S4).
create table public.student_movements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  term_id uuid not null references public.terms (id),
  movement text not null check (movement in
    ('new', 'transfer_in', 'transfer_out', 'withdrawn', 'graduated', 'promoted', 'repeated')),
  moved_on date not null default current_date,
  reason text,
  from_class_id uuid references public.classes (id),
  to_class_id uuid references public.classes (id),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
create index student_movements_student_idx on public.student_movements (student_id);
create index student_movements_term_idx on public.student_movements (term_id);

-- The access code itself is never stored, only its hash (rule C5, decision D8)
create table public.parent_access (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students (id),
  code_hash text not null,
  auth_user_id uuid unique references auth.users (id) on delete set null,   -- added for T22 login
  last_login timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
