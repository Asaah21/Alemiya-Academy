-- T16: publish a class's results for a term, and take them back (rule C3).
-- Publishing is for the Admin only (the results_publish table only lets Admin write).
-- A scored class cannot be published while any active student is missing any score (rule G7).
-- Once published, Staff cannot change scores or remarks (migrations 16 and 17). Unpublishing lets corrections happen;
-- the old publish record is kept in history.

create trigger results_publish_history after delete on public.results_publish
  for each row execute function public.log_history();

create function public.publish_results(p_class uuid, p_term uuid)
returns void
language plpgsql security invoker as $$
declare
  v_status text;
  v_scored boolean;
  v_missing integer;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Only the Admin can publish results';
  end if;
  select status into v_status from public.terms where id = p_term;
  if v_status is null then
    raise exception 'Term not found';
  end if;
  select scored into v_scored from public.classes where id = p_class;
  if v_scored is null then
    raise exception 'Class not found';
  end if;
  if exists (select 1 from public.results_publish where class_id = p_class and term_id = p_term) then
    raise exception 'Results for this class are already published';
  end if;
  if not exists (select 1 from public.students where class_id = p_class and status = 'active') then
    raise exception 'There are no active students in this class';
  end if;

  if v_scored then
    if not exists (select 1 from public.class_subjects where class_id = p_class) then
      raise exception 'No subjects are set for this class. Check Setup, Classes';
    end if;
    select count(*) into v_missing
    from public.students st
    join public.class_subjects cs on cs.class_id = st.class_id
    left join public.scores sc
      on sc.student_id = st.id and sc.subject_id = cs.subject_id and sc.term_id = p_term
    where st.class_id = p_class and st.status = 'active'
      and (sc.id is null or (not sc.is_absent and (sc.class_score is null or sc.exam_score is null)));
    if v_missing > 0 then
      raise exception '% score(s) are still missing. Complete all scores before publishing', v_missing;
    end if;
  end if;

  insert into public.results_publish (class_id, term_id) values (p_class, p_term);
end $$;

create function public.unpublish_results(p_class uuid, p_term uuid)
returns void
language plpgsql security invoker as $$
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Only the Admin can unpublish results';
  end if;
  delete from public.results_publish where class_id = p_class and term_id = p_term;
  if not found then
    raise exception 'These results are not published';
  end if;
end $$;
