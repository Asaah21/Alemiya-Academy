-- T26: term close (rules S5, S6, S8). Admin only.
--  * term_close_check: missing attendance weeks, incomplete scores and unrecorded staff days, listed before closing.
--  * close_term: saves a read-only snapshot (class lists, student and staff attendance, results, fee balances with
--    arrears, turnover) and marks the term closed. Gaps found by the check stop the close unless the Admin accepts them.
--  * reopen_term: the Admin reopens a closed term with a reason (kept on the snapshot). A term cannot be reopened while
--    a later term is closed.
--  * From the moment a term is closed, the database refuses any new or changed attendance, scores, remarks, staff
--    attendance, fee items and payments for it (even a direct request that skips the screens). Voiding a payment is
--    still allowed for the Admin (permissions table: "void a payment or correct a closed record"). Publishing
--    results is a visibility switch and stays possible.
--  * Unpaid balances carry forward (S6): arrears are always worked out from earlier terms' fees and valid payments
--    (migration 21), and the snapshot freezes them as they stood at close.

create function public.block_closed_term() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_term uuid;
  v_date date;
begin
  v_row := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if tg_table_name = 'payments' and tg_op = 'UPDATE' then
    if old.status = 'valid' and new.status = 'void' then
      return new;
    end if;
  end if;
  if tg_table_name = 'attendance_entries' then
    select w.term_id into v_term from public.attendance_weeks w where w.id = (v_row ->> 'week_id')::uuid;
  elsif tg_table_name = 'non_school_days' then
    v_date := (v_row ->> 'non_school_date')::date;
    select t.id into v_term from public.terms t where v_date between t.start_date and t.end_date limit 1;
  else
    v_term := (v_row ->> 'term_id')::uuid;
  end if;
  if v_term is not null and exists (select 1 from public.terms t where t.id = v_term and t.status = 'closed') then
    raise exception 'This term is closed. The Admin can reopen it to make corrections%',
      case when tg_table_name = 'payments' then ', or you can record the payment in the current term' else '' end;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger scores_closed_term before insert or update or delete on public.scores for each row execute function public.block_closed_term();
create trigger report_remarks_closed_term before insert or update or delete on public.report_remarks for each row execute function public.block_closed_term();
create trigger attendance_weeks_closed_term before insert or update or delete on public.attendance_weeks for each row execute function public.block_closed_term();
create trigger attendance_entries_closed_term before insert or update or delete on public.attendance_entries for each row execute function public.block_closed_term();
create trigger staff_attendance_closed_term before insert or update or delete on public.staff_attendance for each row execute function public.block_closed_term();
create trigger non_school_days_closed_term before insert or update or delete on public.non_school_days for each row execute function public.block_closed_term();
create trigger fee_items_closed_term before insert or update or delete on public.fee_items for each row execute function public.block_closed_term();
create trigger payments_closed_term before insert or update on public.payments for each row execute function public.block_closed_term();

create function public.term_close_check(p_term uuid)
returns jsonb
language plpgsql stable security invoker as $$
declare
  v_term public.terms%rowtype;
  v_weeks jsonb;
  v_scores jsonb;
  v_staff integer;
begin
  select * into v_term from public.terms where id = p_term;
  if not found then
    raise exception 'Term not found';
  end if;

  -- a week is due once its Friday is inside the term and has passed (rule A6)
  select coalesce(jsonb_agg(jsonb_build_object('class_id', x.class_id, 'class_name', x.class_name, 'weeks', x.weeks) order by x.level_order), '[]'::jsonb) into v_weeks
    from (
      select c.id as class_id, c.name as class_name, c.level_order, jsonb_agg(m.monday order by m.monday) as weeks
        from public.classes c
        cross join lateral (
          select d::date as monday
            from generate_series(date_trunc('week', v_term.start_date)::date, v_term.end_date, interval '7 days') d
           where d::date + 4 <= v_term.end_date and d::date + 4 <= current_date
        ) m
       where exists (select 1 from public.students s where s.class_id = c.id and s.status = 'active')
         and not exists (select 1 from public.attendance_weeks w where w.class_id = c.id and w.week_start = m.monday)
       group by c.id, c.name, c.level_order
    ) x;

  select coalesce(jsonb_agg(jsonb_build_object('class_id', x.class_id, 'class_name', x.class_name, 'students', x.students, 'incomplete', x.incomplete) order by x.level_order), '[]'::jsonb) into v_scores
    from (
      select c.id as class_id, c.name as class_name, c.level_order, count(*) as students,
             count(*) filter (where r.subjects_expected = 0 or r.subjects_scored < r.subjects_expected) as incomplete
        from public.results_summary(p_term) r join public.classes c on c.id = r.class_id
       group by c.id, c.name, c.level_order
      having count(*) filter (where r.subjects_expected = 0 or r.subjects_scored < r.subjects_expected) > 0
    ) x;

  select count(*) into v_staff
    from generate_series(v_term.start_date, least(v_term.end_date, current_date), interval '1 day') d
   where extract(isodow from d) < 6
     and exists (select 1 from public.staff where status = 'active')
     and not exists (select 1 from public.non_school_days n where n.non_school_date = d::date)
     and not exists (select 1 from public.staff_attendance a where a.attendance_date = d::date);

  return jsonb_build_object('weeks_missing', v_weeks, 'scores_missing', v_scores, 'staff_days_missing', v_staff);
end $$;

create function public.close_term(p_term uuid, p_accept_gaps boolean default false)
returns void
language plpgsql security invoker as $$
declare
  v_term public.terms%rowtype;
  v_check jsonb;
  v_year text;
  v_snapshot jsonb;
  v_rows integer;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Only the Admin can close a term';
  end if;
  select * into v_term from public.terms where id = p_term;
  if not found then
    raise exception 'Term not found';
  end if;
  if v_term.status = 'closed' then
    raise exception 'This term is already closed';
  end if;
  v_check := public.term_close_check(p_term);
  if not p_accept_gaps and (jsonb_array_length(v_check -> 'weeks_missing') > 0 or jsonb_array_length(v_check -> 'scores_missing') > 0 or (v_check ->> 'staff_days_missing')::int > 0) then
    raise exception 'There are gaps in the records. Fix them, or close anyway to accept them';
  end if;
  select name into v_year from public.academic_years where id = v_term.academic_year_id;

  v_snapshot := jsonb_build_object(
    'term', jsonb_build_object('id', v_term.id, 'name', v_term.name, 'year', v_year, 'start_date', v_term.start_date, 'end_date', v_term.end_date),
    'check', v_check,
    'classes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.level_order), '[]'::jsonb) from public.classes c),
    'students', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'full_name', s.full_name, 'admission_no', s.admission_no, 'gender', s.gender, 'class_id', s.class_id) order by s.full_name), '[]'::jsonb) from public.students s where s.status = 'active'),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.attendance_term_totals(p_term) a),
    'staff', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'full_name', f.full_name)), '[]'::jsonb) from public.staff f),
    'staff_attendance', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.staff_attendance_totals(p_term) a),
    'results', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.results_summary(p_term) r),
    'fees', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from public.fee_balances(p_term) b),
    'turnover', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.enrolment_turnover(p_term) t),
    'turnover_students', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.turnover_students(p_term) t)
  );

  insert into public.term_snapshots (term_id, data) values (p_term, v_snapshot);
  update public.terms set status = 'closed' where id = p_term;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Only the Admin can close a term';
  end if;
end $$;

create function public.reopen_term(p_term uuid, p_reason text)
returns void
language plpgsql security invoker as $$
declare
  v_term public.terms%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_rows integer;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Only the Admin can reopen a term';
  end if;
  if length(v_reason) < 3 then
    raise exception 'Give the reason for reopening this term';
  end if;
  if length(v_reason) > 300 then
    raise exception 'The reason can have at most 300 characters';
  end if;
  select * into v_term from public.terms where id = p_term;
  if not found then
    raise exception 'Term not found';
  end if;
  if v_term.status <> 'closed' then
    raise exception 'This term is not closed';
  end if;
  if exists (select 1 from public.terms t where t.status = 'closed' and t.start_date > v_term.start_date) then
    raise exception 'A later term is closed. Reopen that one first';
  end if;
  update public.term_snapshots set reopened_reason = v_reason
   where id = (select s.id from public.term_snapshots s where s.term_id = p_term order by s.closed_at desc limit 1);
  update public.terms set status = 'open' where id = p_term;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Only the Admin can reopen a term';
  end if;
end $$;

grant execute on function public.term_close_check(uuid) to authenticated;
grant execute on function public.close_term(uuid, boolean) to authenticated;
grant execute on function public.reopen_term(uuid, text) to authenticated;
