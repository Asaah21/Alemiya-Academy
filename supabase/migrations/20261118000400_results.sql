-- T02 / migration 4: scores, remarks, publishing

-- Null score = not entered yet. is_absent = student missed the subject (counts as 0, rule G6).
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  subject_id uuid not null references public.subjects (id),
  term_id uuid not null references public.terms (id),
  class_score numeric(6,2) check (class_score >= 0),
  exam_score numeric(6,2) check (exam_score >= 0),
  is_absent boolean not null default false,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  unique (student_id, subject_id, term_id)
);
create index scores_term_idx on public.scores (term_id);

-- Rule G6: a score cannot be above its maximum (30 and 70 unless changed in settings)
create function public.check_score_limits() returns trigger
language plpgsql as $$
declare
  v_class_max numeric;
  v_exam_max numeric;
begin
  select class_score_max, exam_score_max into v_class_max, v_exam_max from public.settings limit 1;
  v_class_max := coalesce(v_class_max, 30);
  v_exam_max := coalesce(v_exam_max, 70);
  if new.class_score > v_class_max then
    raise exception 'Class score cannot be more than %', v_class_max;
  end if;
  if new.exam_score > v_exam_max then
    raise exception 'Exam score cannot be more than %', v_exam_max;
  end if;
  return new;
end $$;

create trigger scores_check_limits
before insert or update on public.scores
for each row execute function public.check_score_limits();

create table public.report_remarks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  term_id uuid not null references public.terms (id),
  teacher_remark text,
  head_remark text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  unique (student_id, term_id)
);

-- A row here means the class's results are published to parents (rule C3)
create table public.results_publish (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id),
  term_id uuid not null references public.terms (id),
  published_at timestamptz not null default now(),
  published_by uuid references auth.users default auth.uid(),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  unique (class_id, term_id)
);
