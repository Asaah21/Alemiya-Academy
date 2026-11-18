-- T07: automatic admission numbers (rule S1) and the "new admission" movement record.
-- Format ALM-<year>-<number>, for example ALM-2026-001. The number counts up within the year
-- of admission. A lock makes sure two people adding students at the same moment never get the same number.

create function public.assign_admission_no() returns trigger
language plpgsql as $$
declare
  v_year text;
  v_next integer;
begin
  if new.admission_no is not null and btrim(new.admission_no) <> '' then
    return new;                       -- Admin typed one in (for example for an old student)
  end if;
  new.admitted_on := coalesce(new.admitted_on, current_date);
  v_year := to_char(new.admitted_on, 'YYYY');
  perform pg_advisory_xact_lock(hashtext('admission_no_' || v_year));
  select coalesce(max(substring(admission_no from '^ALM-' || v_year || '-(\d+)$')::integer), 0) + 1
    into v_next
    from public.students
   where admission_no ~ ('^ALM-' || v_year || '-\d+$');
  new.admission_no := 'ALM-' || v_year || '-' || lpad(v_next::text, 3, '0');
  return new;
end $$;

create trigger students_admission_no before insert on public.students
  for each row execute function public.assign_admission_no();

-- Every new student gets a "new" movement in the current term (basis of enrolment turnover, rule S2).
-- Skipped when no term is marked current yet.
create function public.record_new_admission() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_term uuid;
begin
  select id into v_term from public.terms where is_current limit 1;
  if v_term is not null then
    insert into public.student_movements (student_id, term_id, movement, moved_on, to_class_id, created_by)
    values (new.id, v_term, 'new', coalesce(new.admitted_on, current_date), new.class_id, auth.uid());
  end if;
  return new;
end $$;

create trigger students_new_admission after insert on public.students
  for each row execute function public.record_new_admission();
