-- Scores go back to class score out of 30 plus exam score out of 70 (total out of 100).
-- Rows already saved are not changed. A row saved earlier as a single mark (class score 0, exam score up to 100)
-- still counts correctly in totals, but it must be re-entered as 30 + 70 if it is edited again.
update public.settings set class_score_max = 30, exam_score_max = 70;
alter table public.settings alter column class_score_max set default 30;
alter table public.settings alter column exam_score_max set default 70;

create or replace function public.check_score_limits() returns trigger
language plpgsql as $$
declare
  v_class_max numeric;
  v_exam_max numeric;
begin
  select class_score_max, exam_score_max into v_class_max, v_exam_max from public.settings limit 1;
  v_class_max := coalesce(v_class_max, 30);
  v_exam_max := coalesce(v_exam_max, 70);
  if new.class_score > v_class_max then
    raise exception 'The class score cannot be more than %', v_class_max;
  end if;
  if new.exam_score > v_exam_max then
    raise exception 'The exam score cannot be more than %', v_exam_max;
  end if;
  return new;
end $$;
