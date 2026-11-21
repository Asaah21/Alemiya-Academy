-- T23: what a parent can see about their own child (rule C3, C5, decision D8).
-- Parents have no direct table access (migration 23). These functions are their only way in. Each one finds the
-- child from the parent's login, and returns nothing or refuses for anyone who is not an active parent.
-- Results are returned only when the Admin has published them for the child's class and term (rule C3).
-- A parent never receives classmates' names or scores: the class is only described by a list of anonymous
-- overall totals, so the screen can work out the child's position.

create function public.parent_child_id() returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.parent_access pa join public.students s on s.id = pa.student_id
   where pa.auth_user_id = auth.uid() and pa.active and s.status = 'active'
$$;
revoke execute on function public.parent_child_id() from public;

-- Terms for which this child's class has published results.
create function public.parent_result_terms()
returns table (term_id uuid, term_name text, year_name text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, y.name
    from public.students s
    join public.results_publish rp on rp.class_id = s.class_id
    join public.terms t on t.id = rp.term_id
    join public.academic_years y on y.id = t.academic_year_id
   where s.id = public.parent_child_id()
   order by t.start_date desc
$$;

create function public.parent_report(p_term uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_student public.students%rowtype;
  v_scored boolean;
  v_class_name text;
  v_term public.terms%rowtype;
  v_year text;
  v_settings public.settings%rowtype;
  v_subjects jsonb;
  v_scores jsonb;
  v_remark jsonb;
  v_att jsonb;
  v_totals jsonb;
  v_size integer;
begin
  select * into v_student from public.students where id = public.parent_child_id();
  if not found then
    raise exception 'Not available';
  end if;
  if not exists (select 1 from public.results_publish where class_id = v_student.class_id and term_id = p_term) then
    raise exception 'These results have not been published yet';
  end if;
  select c.scored, c.name into v_scored, v_class_name from public.classes c where c.id = v_student.class_id;
  select * into v_term from public.terms where id = p_term;
  select name into v_year from public.academic_years where id = v_term.academic_year_id;
  select * into v_settings from public.settings limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('id', sb.id, 'name', sb.name) order by sb.name), '[]'::jsonb) into v_subjects
    from public.class_subjects cs join public.subjects sb on sb.id = cs.subject_id
   where cs.class_id = v_student.class_id and v_scored;

  select coalesce(jsonb_agg(jsonb_build_object('student_id', sc.student_id, 'subject_id', sc.subject_id, 'class_score', sc.class_score, 'exam_score', sc.exam_score, 'is_absent', sc.is_absent)), '[]'::jsonb) into v_scores
    from public.scores sc where sc.student_id = v_student.id and sc.term_id = p_term and v_scored;

  select jsonb_build_object('student_id', r.student_id, 'teacher_remark', r.teacher_remark, 'head_remark', r.head_remark) into v_remark
    from public.report_remarks r where r.student_id = v_student.id and r.term_id = p_term;

  select jsonb_build_object('student_id', v_student.id, 'school_days', sum(w.school_days), 'days_absent', sum(e.days_absent)) into v_att
    from public.attendance_entries e join public.attendance_weeks w on w.id = e.week_id
   where e.student_id = v_student.id and w.term_id = p_term
  having count(*) > 0;

  select count(*) into v_size from public.students where class_id = v_student.class_id and status = 'active';

  -- anonymous overall totals of every active student in the class (class + exam, absent counts 0), for the position
  select coalesce(jsonb_agg(t.total), '[]'::jsonb) into v_totals
    from (
      select coalesce(sum(coalesce(sc.class_score, 0) + coalesce(sc.exam_score, 0)), 0) as total
        from public.students st
        left join public.scores sc on sc.student_id = st.id and sc.term_id = p_term
       where st.class_id = v_student.class_id and st.status = 'active'
       group by st.id
    ) t
   where v_scored;

  return jsonb_build_object(
    'school', jsonb_build_object('name', v_settings.school_name, 'location', v_settings.location, 'district', v_settings.district,
      'region', v_settings.region, 'circuit', v_settings.circuit, 'logo_url', v_settings.logo_url,
      'next_term_opening_date', v_settings.next_term_opening_date, 'class_score_max', v_settings.class_score_max, 'exam_score_max', v_settings.exam_score_max),
    'student', jsonb_build_object('id', v_student.id, 'full_name', v_student.full_name, 'admission_no', v_student.admission_no),
    'class_name', v_class_name, 'term_name', v_term.name, 'year_name', v_year, 'scored', v_scored,
    'scale', (select coalesce(jsonb_agg(jsonb_build_object('min_score', g.min_score, 'max_score', g.max_score, 'grade', g.grade, 'remark', g.remark)), '[]'::jsonb) from public.grade_scale g),
    'subjects', v_subjects, 'scores', v_scores, 'remark', v_remark, 'attendance', v_att,
    'class_totals', v_totals, 'class_size', v_size
  );
end $$;

-- Fees: what the child owes and has paid, term by term (terms that have started), and the valid receipts.
create function public.parent_fees()
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
        left join (select term_id, sum(amount) as total from public.fee_items where class_id = v_student.class_id group by term_id) f on f.term_id = t.id
        left join (select term_id, sum(amount) as total from public.payments where student_id = v_student.id and status = 'valid' group by term_id) p on p.term_id = t.id
       where t.start_date <= current_date and (f.total is not null or p.total is not null)
    ) q;
  select coalesce(jsonb_agg(jsonb_build_object('receipt_no', py.receipt_no, 'amount', py.amount, 'paid_on', py.paid_on, 'term_name', t.name) order by py.paid_on desc, py.receipt_no desc), '[]'::jsonb) into v_pay
    from public.payments py join public.terms t on t.id = py.term_id
   where py.student_id = v_student.id and py.status = 'valid';
  return jsonb_build_object('terms', v_terms, 'payments', v_pay);
end $$;

-- Attendance for each term: school days recorded and days absent.
create function public.parent_attendance()
returns table (term_name text, year_name text, school_days bigint, days_absent bigint)
language sql stable security definer set search_path = public as $$
  select t.name, y.name, sum(w.school_days)::bigint, sum(e.days_absent)::bigint
    from public.attendance_entries e
    join public.attendance_weeks w on w.id = e.week_id
    join public.terms t on t.id = w.term_id
    join public.academic_years y on y.id = t.academic_year_id
   where e.student_id = public.parent_child_id()
   group by t.id, t.name, t.start_date, y.name
   order by t.start_date desc
$$;

revoke execute on function public.parent_result_terms() from public;
revoke execute on function public.parent_report(uuid) from public;
revoke execute on function public.parent_fees() from public;
revoke execute on function public.parent_attendance() from public;
grant execute on function public.parent_result_terms() to authenticated;
grant execute on function public.parent_report(uuid) to authenticated;
grant execute on function public.parent_fees() to authenticated;
grant execute on function public.parent_attendance() to authenticated;
