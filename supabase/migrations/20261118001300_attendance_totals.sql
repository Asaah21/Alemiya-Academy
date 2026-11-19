-- T11: attendance totals per student for one term (rules A5 to A7).
-- Only weeks that were saved are counted, so unrecorded weeks never lower a rate (rule A6).
-- A student only counts for weeks where they have an entry (someone who joined later is not marked absent for earlier weeks).
-- Runs with the caller's rights: Admin and Staff can read attendance.

create function public.attendance_term_totals(p_term uuid)
returns table (class_id uuid, student_id uuid, weeks bigint, school_days bigint, days_absent bigint)
language sql stable security invoker as $$
  select w.class_id, e.student_id, count(*), sum(w.school_days), sum(e.days_absent)
    from public.attendance_entries e
    join public.attendance_weeks w on w.id = e.week_id
   where w.term_id = p_term
   group by w.class_id, e.student_id
$$;

grant execute on function public.attendance_term_totals(uuid) to authenticated;
