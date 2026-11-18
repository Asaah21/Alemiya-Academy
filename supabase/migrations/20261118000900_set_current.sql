-- T05: switch the current term (and its academic year) in one step.
-- The unique indexes allow only one current row, so the old one must be cleared first.
-- Runs with the caller's own rights (security invoker), so only Admin can use it.

create or replace function public.set_current_term(p_term_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_year uuid;
begin
  select academic_year_id into v_year from public.terms where id = p_term_id;
  if v_year is null then
    raise exception 'Term not found';
  end if;

  update public.terms set is_current = false where is_current and id <> p_term_id;
  update public.academic_years set is_current = false where is_current and id <> v_year;
  update public.academic_years set is_current = true where id = v_year;
  update public.terms set is_current = true where id = p_term_id;

  if not exists (select 1 from public.terms where id = p_term_id and is_current) then
    raise exception 'Only the Admin can change the current term';
  end if;
end;
$$;

grant execute on function public.set_current_term(uuid) to authenticated;
