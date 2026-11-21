-- T24: enrolment turnover per class and gender for one term, and the students behind each number (rules S2 to S4).
-- Every movement is a +1 for the class the student went into and a -1 for the class they left (migration 9 and
-- the new-admission trigger record them with a date). A term's movements are the ones dated from the term's start
-- up to the day before the next term starts (the last term has no end), so holidays between terms belong to the term
-- before them and a term's opening roll always equals the closing roll of the term before.
--   opening = students in the class at the term's start
--   closing = opening + new admissions + transfers in (+ promoted in) - transfers out - withdrawn - graduated (- promoted out)
-- Attrition rate = (transfers out + withdrawn) / opening x 100, worked out on screen.
-- Runs with the caller's rights (the Reports screens are Admin only).

create function public.enrolment_turnover(p_term uuid)
returns table (class_id uuid, gender text, opening bigint, new_admissions bigint, transfers_in bigint, transfers_out bigint,
               withdrawn bigint, graduated bigint, promoted_in bigint, promoted_out bigint, closing bigint)
language sql stable security invoker as $$
  with t as (
    select tm.start_date,
           (select min(t2.start_date) from public.terms t2 where t2.start_date > tm.start_date) as next_start
      from public.terms tm where tm.id = p_term
  ),
  ev as (
    select m.to_class_id as class_id, s.gender, m.moved_on, m.movement, 1 as delta, true as is_in
      from public.student_movements m join public.students s on s.id = m.student_id
     where m.to_class_id is not null
    union all
    select m.from_class_id, s.gender, m.moved_on, m.movement, -1, false
      from public.student_movements m join public.students s on s.id = m.student_id
     where m.from_class_id is not null
  ),
  sums as (
    select e.class_id, e.gender,
           coalesce(sum(e.delta) filter (where e.moved_on < t.start_date), 0) as opening,
           count(*) filter (where in_win and e.is_in and e.movement = 'new') as new_admissions,
           count(*) filter (where in_win and e.is_in and e.movement = 'transfer_in') as transfers_in,
           count(*) filter (where in_win and not e.is_in and e.movement = 'transfer_out') as transfers_out,
           count(*) filter (where in_win and not e.is_in and e.movement = 'withdrawn') as withdrawn,
           count(*) filter (where in_win and not e.is_in and e.movement = 'graduated') as graduated,
           count(*) filter (where in_win and e.is_in and e.movement = 'promoted') as promoted_in,
           count(*) filter (where in_win and not e.is_in and e.movement = 'promoted') as promoted_out,
           coalesce(sum(e.delta) filter (where t.next_start is null or e.moved_on < t.next_start), 0) as closing
      from ev e cross join t
      cross join lateral (select e.moved_on >= t.start_date and (t.next_start is null or e.moved_on < t.next_start) as in_win) w
     group by e.class_id, e.gender
  )
  select c.id, g.gender,
         coalesce(s.opening, 0), coalesce(s.new_admissions, 0), coalesce(s.transfers_in, 0), coalesce(s.transfers_out, 0),
         coalesce(s.withdrawn, 0), coalesce(s.graduated, 0), coalesce(s.promoted_in, 0), coalesce(s.promoted_out, 0), coalesce(s.closing, 0)
    from public.classes c
    cross join (values ('male'), ('female')) as g (gender)
    left join sums s on s.class_id = c.id and s.gender = g.gender
   order by c.level_order, g.gender
$$;

create function public.turnover_students(p_term uuid)
returns table (student_id uuid, full_name text, admission_no text, gender text, class_id uuid, movement text, moved_on date, reason text)
language sql stable security invoker as $$
  with t as (
    select tm.start_date,
           (select min(t2.start_date) from public.terms t2 where t2.start_date > tm.start_date) as next_start
      from public.terms tm where tm.id = p_term
  )
  select s.id, s.full_name, s.admission_no, s.gender, coalesce(m.to_class_id, m.from_class_id), m.movement, m.moved_on, m.reason
    from public.student_movements m
    join public.students s on s.id = m.student_id
    cross join t
   where m.movement in ('new', 'transfer_in', 'transfer_out', 'withdrawn', 'graduated')
     and m.moved_on >= t.start_date and (t.next_start is null or m.moved_on < t.next_start)
   order by m.moved_on, s.full_name
$$;

grant execute on function public.enrolment_turnover(uuid) to authenticated;
grant execute on function public.turnover_students(uuid) to authenticated;
