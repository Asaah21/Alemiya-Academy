-- T14: save a class's teacher and headmaster remarks for one term in one step (rule G9).
-- p_rows is a list like [{"student_id": "...", "teacher_remark": "...", "head_remark": "..."}].
-- Runs with the caller's rights (Staff and Admin may both write remarks). Saving again corrects them;
-- only rows that really changed are touched, so history keeps just the real corrections.

create function public.save_remarks(p_class uuid, p_term uuid, p_rows jsonb)
returns integer
language plpgsql security invoker as $$
declare
  v_status text;
  v_row jsonb;
  v_student uuid;
  v_teacher text;
  v_head text;
  v_count integer := 0;
begin
  select status into v_status from public.terms where id = p_term;
  if v_status is null then
    raise exception 'Term not found';
  end if;
  if v_status = 'closed' then
    raise exception 'This term is closed';
  end if;
  if exists (select 1 from public.results_publish where class_id = p_class and term_id = p_term) then
    raise exception 'Results for this class are already published. Ask the Admin before changing remarks';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_student := (v_row ->> 'student_id')::uuid;
    v_teacher := nullif(btrim(coalesce(v_row ->> 'teacher_remark', '')), '');
    v_head := nullif(btrim(coalesce(v_row ->> 'head_remark', '')), '');
    if length(coalesce(v_teacher, '')) > 300 or length(coalesce(v_head, '')) > 300 then
      raise exception 'A remark can have at most 300 characters';
    end if;
    if not exists (select 1 from public.students where id = v_student and class_id = p_class) then
      raise exception 'A student in the list is not in this class';
    end if;
    if v_teacher is null and v_head is null
       and not exists (select 1 from public.report_remarks where student_id = v_student and term_id = p_term) then
      continue;
    end if;
    insert into public.report_remarks (student_id, term_id, teacher_remark, head_remark)
    values (v_student, p_term, v_teacher, v_head)
    on conflict (student_id, term_id) do update
      set teacher_remark = excluded.teacher_remark, head_remark = excluded.head_remark
      where (public.report_remarks.teacher_remark, public.report_remarks.head_remark)
            is distinct from (excluded.teacher_remark, excluded.head_remark);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

grant execute on function public.save_remarks(uuid, uuid, jsonb) to authenticated;
