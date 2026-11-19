-- T10: save one class's attendance for one week in a single step (rules A1 to A5, A8).
-- p_entries is a list like [{"student_id": "...", "days_absent": 2}]. Students left out are treated as 0 absences.
-- Runs with the caller's own rights, so the access rules for Staff and Admin still apply.
-- Saving again corrects the week; the history trigger keeps the old values, and only rows that really changed are touched.

create function public.save_attendance_week(
  p_class uuid, p_week_start date, p_school_days integer, p_entries jsonb
) returns uuid
language plpgsql security invoker as $$
declare
  v_term uuid;
  v_term_status text;
  v_week uuid;
  v_entry jsonb;
  v_days integer;
begin
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'The week must start on a Monday';
  end if;
  if p_school_days is null or p_school_days < 0 or p_school_days > 7 then
    raise exception 'School days must be between 0 and 7';
  end if;

  -- the term this week belongs to (judged by the Friday)
  select id, status into v_term, v_term_status
    from public.terms
   where p_week_start + 4 between start_date and end_date
   limit 1;
  if v_term is null then
    raise exception 'This week is not inside any term. Check Setup, Academic years and terms';
  end if;
  if v_term_status = 'closed' then
    raise exception 'This term is closed';
  end if;

  -- creating the week row first; if it exists only the school days may change
  insert into public.attendance_weeks (class_id, term_id, week_start, school_days)
  values (p_class, v_term, p_week_start, p_school_days)
  on conflict (class_id, week_start) do update
    set school_days = excluded.school_days
    where public.attendance_weeks.school_days is distinct from excluded.school_days
  returning id into v_week;
  if v_week is null then
    select id into v_week from public.attendance_weeks where class_id = p_class and week_start = p_week_start;
  end if;

  for v_entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    v_days := coalesce((v_entry ->> 'days_absent')::integer, 0);
    if not exists (select 1 from public.students where id = (v_entry ->> 'student_id')::uuid and class_id = p_class) then
      raise exception 'A student in the list is not in this class';
    end if;
    insert into public.attendance_entries (week_id, student_id, days_absent)
    values (v_week, (v_entry ->> 'student_id')::uuid, v_days)
    on conflict (week_id, student_id) do update
      set days_absent = excluded.days_absent
      where public.attendance_entries.days_absent is distinct from excluded.days_absent;
  end loop;

  return v_week;
end $$;

grant execute on function public.save_attendance_week(uuid, date, integer, jsonb) to authenticated;
