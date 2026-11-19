-- T12: save one class's scores for one subject and term in a single step (rules G1, G6).
-- p_rows is a list like [{"student_id": "...", "class_score": 24, "exam_score": 51.5, "is_absent": false}].
-- A blank score is sent as null (not entered yet). An absent student has both scores cleared: it counts as 0 (rule G6).
-- Runs with the caller's rights. The score limit trigger from migration 4 still applies to every row.
-- Saving again corrects the scores; only rows that really changed are touched, so history keeps just the real corrections.

create function public.save_scores(p_class uuid, p_subject uuid, p_term uuid, p_rows jsonb)
returns integer
language plpgsql security invoker as $$
declare
  v_status text;
  v_row jsonb;
  v_student uuid;
  v_class numeric;
  v_exam numeric;
  v_absent boolean;
  v_count integer := 0;
begin
  select status into v_status from public.terms where id = p_term;
  if v_status is null then
    raise exception 'Term not found';
  end if;
  if v_status = 'closed' then
    raise exception 'This term is closed';
  end if;
  if not exists (select 1 from public.class_subjects where class_id = p_class and subject_id = p_subject) then
    raise exception 'This subject is not taught in this class. Check Setup, Classes';
  end if;
  if exists (select 1 from public.results_publish where class_id = p_class and term_id = p_term) then
    raise exception 'Results for this class are already published. Ask the Admin before changing scores';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_student := (v_row ->> 'student_id')::uuid;
    v_absent := coalesce((v_row ->> 'is_absent')::boolean, false);
    v_class := case when v_absent then null else nullif(v_row ->> 'class_score', '')::numeric end;
    v_exam := case when v_absent then null else nullif(v_row ->> 'exam_score', '')::numeric end;

    if not exists (select 1 from public.students where id = v_student and class_id = p_class) then
      raise exception 'A student in the list is not in this class';
    end if;

    if v_class is null and v_exam is null and not v_absent
       and not exists (select 1 from public.scores where student_id = v_student and subject_id = p_subject and term_id = p_term) then
      continue;   -- nothing entered and nothing saved before: no row needed
    end if;

    insert into public.scores (student_id, subject_id, term_id, class_score, exam_score, is_absent)
    values (v_student, p_subject, p_term, v_class, v_exam, v_absent)
    on conflict (student_id, subject_id, term_id) do update
      set class_score = excluded.class_score, exam_score = excluded.exam_score, is_absent = excluded.is_absent
      where (public.scores.class_score, public.scores.exam_score, public.scores.is_absent)
            is distinct from (excluded.class_score, excluded.exam_score, excluded.is_absent);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

grant execute on function public.save_scores(uuid, uuid, uuid, jsonb) to authenticated;
