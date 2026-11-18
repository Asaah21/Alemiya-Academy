-- T02 / migration 6: term snapshots, history of corrections, no-delete protection

-- Written when a term is closed (rule S5). A reopened and re-closed term gets a new row.
create table public.term_snapshots (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id),
  data jsonb not null,
  closed_by uuid references auth.users default auth.uid(),
  closed_at timestamptz not null default now(),
  reopened_reason text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
create index term_snapshots_term_idx on public.term_snapshots (term_id);

-- Earlier values of any corrected record (rules A8, ST3)
create table public.history (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  old_values jsonb not null,
  changed_by uuid references auth.users default auth.uid(),
  changed_at timestamptz not null default now()
);
create index history_record_idx on public.history (table_name, record_id);

create function public.log_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.history (table_name, record_id, old_values, changed_by)
  values (tg_table_name, old.id, to_jsonb(old), auth.uid());
  return new;
end $$;

create trigger students_history after update on public.students
  for each row execute function public.log_history();
create trigger staff_history after update on public.staff
  for each row execute function public.log_history();
create trigger attendance_weeks_history after update on public.attendance_weeks
  for each row execute function public.log_history();
create trigger attendance_entries_history after update on public.attendance_entries
  for each row execute function public.log_history();
create trigger staff_attendance_history after update on public.staff_attendance
  for each row execute function public.log_history();
create trigger scores_history after update on public.scores
  for each row execute function public.log_history();
create trigger report_remarks_history after update on public.report_remarks
  for each row execute function public.log_history();
create trigger fee_items_history after update on public.fee_items
  for each row execute function public.log_history();

-- Decision D9: records are never deleted. Corrections are made by editing (history keeps the old
-- values) or by voiding. Payments have their own protection in migration 5.
create function public.block_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Records in % cannot be deleted.', tg_table_name;
end $$;

create trigger students_no_delete before delete on public.students
  for each row execute function public.block_delete();
create trigger student_movements_no_delete before delete on public.student_movements
  for each row execute function public.block_delete();
create trigger attendance_weeks_no_delete before delete on public.attendance_weeks
  for each row execute function public.block_delete();
create trigger attendance_entries_no_delete before delete on public.attendance_entries
  for each row execute function public.block_delete();
create trigger staff_attendance_no_delete before delete on public.staff_attendance
  for each row execute function public.block_delete();
create trigger scores_no_delete before delete on public.scores
  for each row execute function public.block_delete();
create trigger term_snapshots_no_delete before delete on public.term_snapshots
  for each row execute function public.block_delete();
create trigger history_no_delete before delete on public.history
  for each row execute function public.block_delete();
