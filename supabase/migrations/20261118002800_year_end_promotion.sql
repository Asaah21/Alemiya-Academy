-- T27: year-end promotion (rule S7). Admin only.
-- Moves every active student up to the next class (by class order), keeps repeaters in their class, and graduates
-- students in the last class (JHS 3). Every change is a dated movement in the student's history (rule S2), so
-- nothing is lost: graduates keep their record and history.
--
-- Because students now change class, "which class was this student in at that time?" matters for old fees.
-- student_class_on answers it from the movement history, and fee_balances and parent_fees now use it, so arrears
-- from an earlier term are worked out from the fees of the class the student was really in then.

create function public.student_class_on(p_student uuid, p_date date)
returns uuid
language sql stable as $$
  -- The class of the latest move on or before the date. If the student was entered into the system after that
  -- date (for example existing pupils added later), use the first class they were recorded in.
  select coalesce(
    (select m.to_class_id from public.student_movements m
      where m.student_id = p_student and m.to_class_id is not null and m.moved_on <= p_date
      order by m.moved_on desc, m.created_at desc limit 1),
    (select m.to_class_id from public.student_movements m
      where m.student_id = p_student and m.to_class_id is not null
      order by m.moved_on asc, m.created_at asc limit 1),
    (select s.class_id from public.students s where s.id = p_student)
  )
$$;

create or replace function public.fee_balances(p_term uuid, p_class uuid default null)
returns table (student_id uuid, admission_no text, full_name text, class_id uuid, owed numeric, paid numeric, balance numeric, arrears numeric)
language sql stable security invoker as $$
  with this_term as (select start_date from public.terms where id = p_term),
  fees as (select fi.class_id, fi.term_id, sum(fi.amount) as total from public.fee_items fi group by fi.class_id, fi.term_id),
  pay as (select py.student_id, py.term_id, sum(py.amount) as total from public.payments py where py.status = 'valid' group by py.student_id, py.term_id)
  select s.id, s.admission_no, s.full_name, s.class_id,
         coalesce(f.total, 0), coalesce(p.total, 0), coalesce(f.total, 0) - coalesce(p.total, 0),
         coalesce((
           select sum(
                    coalesce((select sum(fi.amount) from public.fee_items fi
                               where fi.term_id = t2.id and fi.class_id = public.student_class_on(s.id, t2.end_date)), 0)
                    - coalesce(p2.total, 0))
             from public.terms t2
             left join pay p2 on p2.student_id = s.id and p2.term_id = t2.id
            where t2.start_date < (select start_date from this_term)
         ), 0)
    from public.students s
    left join fees f on f.class_id = s.class_id and f.term_id = p_term
    left join pay p on p.student_id = s.id and p.term_id = p_term
   where s.status = 'active' and (p_class is null or s.class_id = p_class)
   order by s.full_name
$$;

create or replace function public.parent_fees()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_student public.students%rowtype;
  v_terms jsonb;
  v_pay jsonb;
begin
  select * into v_student from public.students where id = public.parent_child_id();
  if not found then
    raise exception 'Not available';
  end if;
  select coalesce(jsonb_agg(q.j order by q.start_date desc), '[]'::jsonb) into v_terms
    from (
      select t.start_date, jsonb_build_object('term_id', t.id, 'term_name', t.name, 'year_name', y.name,
               'owed', coalesce(f.total, 0), 'paid', coalesce(p.total, 0), 'balance', coalesce(f.total, 0) - coalesce(p.total, 0)) as j
        from public.terms t
        join public.academic_years y on y.id = t.academic_year_id
        left join lateral (
          select sum(fi.amount) as total from public.fee_items fi
           where fi.term_id = t.id and fi.class_id = public.student_class_on(v_student.id, least(t.end_date, current_date))
        ) f on true
        left join (select term_id, sum(amount) as total from public.payments where student_id = v_student.id and status = 'valid' group by term_id) p on p.term_id = t.id
       where t.start_date <= current_date and (f.total is not null or p.total is not null)
    ) q;
  select coalesce(jsonb_agg(jsonb_build_object('receipt_no', py.receipt_no, 'amount', py.amount, 'paid_on', py.paid_on, 'term_name', t.name) order by py.paid_on desc, py.receipt_no desc), '[]'::jsonb) into v_pay
    from public.payments py join public.terms t on t.id = py.term_id
   where py.student_id = v_student.id and py.status = 'valid';
  return jsonb_build_object('terms', v_terms, 'payments', v_pay);
end $$;

create function public.promote_year(p_year uuid, p_repeaters uuid[], p_moved_on date)
returns table (promoted integer, repeated integer, graduated integer)
language plpgsql security invoker as $$
declare
  v_last public.terms%rowtype;
  r record;
  v_next uuid;
  v_promoted integer := 0;
  v_repeated integer := 0;
  v_graduated integer := 0;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Only the Admin can promote students';
  end if;
  select * into v_last from public.terms where academic_year_id = p_year order by start_date desc limit 1;
  if not found then
    raise exception 'This academic year has no terms';
  end if;
  if exists (select 1 from public.terms t where t.academic_year_id = p_year and t.status <> 'closed') then
    raise exception 'Close every term of this year first';
  end if;
  if p_moved_on is null or p_moved_on <= v_last.end_date then
    raise exception 'The promotion date must be after the last term of the year ends';
  end if;
  if p_moved_on > current_date then
    raise exception 'The date cannot be in the future';
  end if;
  if exists (select 1 from public.student_movements m where m.term_id = v_last.id and m.movement in ('promoted', 'repeated')) then
    raise exception 'Promotion has already been done for this year';
  end if;

  for r in
    select s.id, s.class_id, c.level_order
      from public.students s join public.classes c on c.id = s.class_id
     where s.status = 'active'
     order by s.full_name
  loop
    select c2.id into v_next from public.classes c2 where c2.level_order > r.level_order order by c2.level_order limit 1;
    if r.id = any (coalesce(p_repeaters, '{}')) then
      insert into public.student_movements (student_id, term_id, movement, moved_on, reason, from_class_id, to_class_id)
      values (r.id, v_last.id, 'repeated', p_moved_on, 'Repeats the class', r.class_id, r.class_id);
      v_repeated := v_repeated + 1;
    elsif v_next is null then
      update public.students set status = 'graduated' where id = r.id;
      insert into public.student_movements (student_id, term_id, movement, moved_on, reason, from_class_id)
      values (r.id, v_last.id, 'graduated', p_moved_on, 'Completed the last class', r.class_id);
      v_graduated := v_graduated + 1;
    else
      update public.students set class_id = v_next where id = r.id;
      insert into public.student_movements (student_id, term_id, movement, moved_on, reason, from_class_id, to_class_id)
      values (r.id, v_last.id, 'promoted', p_moved_on, 'Promoted at the end of the year', r.class_id, v_next);
      v_promoted := v_promoted + 1;
    end if;
  end loop;

  return query select v_promoted, v_repeated, v_graduated;
end $$;

grant execute on function public.student_class_on(uuid, date) to authenticated;
grant execute on function public.promote_year(uuid, uuid[], date) to authenticated;
