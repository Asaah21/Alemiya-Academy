-- T35: staff attendance counts per person for one term (rules ST4 to ST6).
-- Counts only saved days. Days marked as non-school days are left out.
-- Admin only, because the staff_attendance table is Admin only.

create function public.staff_attendance_totals(p_term uuid)
returns table (staff_id uuid, present bigint, late bigint, absent bigint, on_leave bigint)
language sql stable security invoker as $$
  select a.staff_id,
         count(*) filter (where a.status = 'present'),
         count(*) filter (where a.status = 'late'),
         count(*) filter (where a.status = 'absent'),
         count(*) filter (where a.status = 'on_leave')
    from public.staff_attendance a
   where a.term_id = p_term
     and not exists (select 1 from public.non_school_days n where n.non_school_date = a.attendance_date)
   group by a.staff_id
$$;

grant execute on function public.staff_attendance_totals(uuid) to authenticated;
