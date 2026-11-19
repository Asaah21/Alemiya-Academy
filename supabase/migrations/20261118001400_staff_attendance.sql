-- T34: daily staff attendance by the Admin (rules ST1 to ST5).
-- Runs with the caller's rights: the access rules already limit staff_attendance and non_school_days to the Admin.
-- Saving again corrects the day; only rows that really changed are touched, so history keeps just the real corrections.

create function public.save_staff_attendance(p_date date, p_entries jsonb)
returns integer
language plpgsql security invoker as $$
declare
  v_term uuid;
  v_term_status text;
  v_entry jsonb;
  v_status text;
  v_staff uuid;
  v_count integer := 0;
begin
  if p_date is null or p_date > current_date then
    raise exception 'The date cannot be in the future';
  end if;
  if exists (select 1 from public.non_school_days where non_school_date = p_date) then
    raise exception 'This day is marked as a non-school day';
  end if;
  select id, status into v_term, v_term_status from public.terms where p_date between start_date and end_date limit 1;
  if v_term is null then
    raise exception 'This date is not inside any term. Check Setup, Academic years and terms';
  end if;
  if v_term_status = 'closed' then
    raise exception 'This term is closed';
  end if;

  for v_entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    v_staff := (v_entry ->> 'staff_id')::uuid;
    v_status := coalesce(v_entry ->> 'status', 'present');
    if v_status not in ('present', 'absent', 'late', 'on_leave') then
      raise exception 'Unknown attendance status %', v_status;
    end if;
    if not exists (select 1 from public.staff where id = v_staff) then
      raise exception 'A person in the list is not on the staff list';
    end if;
    insert into public.staff_attendance (staff_id, attendance_date, term_id, status, note)
    values (v_staff, p_date, v_term, v_status, nullif(btrim(coalesce(v_entry ->> 'note', '')), ''))
    on conflict (staff_id, attendance_date) do update
      set status = excluded.status, note = excluded.note
      where (public.staff_attendance.status, public.staff_attendance.note) is distinct from (excluded.status, excluded.note);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Marks a holiday or closure for everyone (rule ST4). Refused if attendance was already saved that day.
create function public.set_non_school_day(p_date date, p_reason text)
returns void
language plpgsql security invoker as $$
declare
  v_term uuid;
  v_rows integer;
begin
  if exists (select 1 from public.staff_attendance where attendance_date = p_date) then
    raise exception 'Attendance was already saved for this day. It cannot be a non-school day';
  end if;
  select id into v_term from public.terms where p_date between start_date and end_date limit 1;
  insert into public.non_school_days (non_school_date, term_id, reason)
  values (p_date, v_term, nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (non_school_date) do update set reason = excluded.reason;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Only the Admin can mark a non-school day';
  end if;
end $$;

grant execute on function public.save_staff_attendance(date, jsonb) to authenticated;
grant execute on function public.set_non_school_day(date, text) to authenticated;
