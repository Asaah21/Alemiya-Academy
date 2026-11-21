-- T25: one row per active student of a scored class for a term, so the Results summary report can add things up
-- without the phone downloading every score (the database returns at most 1000 rows per request).
--   subjects_expected = subjects set for the class
--   subjects_scored   = subjects with a score or marked Absent (rule G6)
--   overall           = total of class + exam scores over the subjects; Absent counts 0 (rule G3)
-- Complete = subjects_scored = subjects_expected and at least one subject (rule G7).
-- Runs with the caller's rights.

create function public.results_summary(p_term uuid)
returns table (student_id uuid, class_id uuid, subjects_expected bigint, subjects_scored bigint, overall numeric)
language sql stable security invoker as $$
  select s.id, s.class_id,
         (select count(*) from public.class_subjects cs where cs.class_id = s.class_id),
         (select count(*) from public.scores sc
           where sc.student_id = s.id and sc.term_id = p_term
             and sc.subject_id in (select cs.subject_id from public.class_subjects cs where cs.class_id = s.class_id)
             and (sc.is_absent or (sc.class_score is not null and sc.exam_score is not null))),
         coalesce((select sum(coalesce(sc.class_score, 0) + coalesce(sc.exam_score, 0)) from public.scores sc
           where sc.student_id = s.id and sc.term_id = p_term
             and sc.subject_id in (select cs.subject_id from public.class_subjects cs where cs.class_id = s.class_id)), 0)
    from public.students s
    join public.classes c on c.id = s.class_id and c.scored
   where s.status = 'active'
$$;

grant execute on function public.results_summary(uuid) to authenticated;
