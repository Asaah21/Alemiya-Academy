-- Scores are now entered as ONE mark out of 100 per subject (no 30/70 split).
-- The mark is stored in exam_score and class_score is stored as 0, so totals, grades, positions, report cards,
-- parent views and summaries keep working unchanged (total = class_score + exam_score).
-- Older rows that were entered as class + exam still add up to the same total and show as one mark.
update public.settings set exam_score_max = 100;
alter table public.settings alter column exam_score_max set default 100;

-- Rule G6 now: one mark cannot be above the maximum (100 unless changed in settings).
create or replace function public.check_score_limits() returns trigger
language plpgsql as $$
declare
  v_class_max numeric;
  v_exam_max numeric;
begin
  select class_score_max, exam_score_max into v_class_max, v_exam_max from public.settings limit 1;
  v_class_max := coalesce(v_class_max, 100);
  v_exam_max := coalesce(v_exam_max, 100);
  if new.class_score > v_class_max or new.exam_score > v_exam_max then
    raise exception 'The score cannot be more than %', v_exam_max;
  end if;
  return new;
end $$;
