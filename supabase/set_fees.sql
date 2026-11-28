-- Sets the school fees for the CURRENT TERM: GHS 345 for Nursery 1, Nursery 2, KG 1 and KG 2, and GHS 355 for every
-- other class. Each class gets one fee line called "School fees".
-- Any other fee lines already entered for this term are replaced (the old ones stay in the history).
-- Payments already recorded are not touched; balances simply follow the new fees.
-- Run in the Supabase SQL Editor. You can change any class afterwards in Set up > Fees.
do $$
declare
  v_term uuid;
  v_n integer;
begin
  select id into v_term from public.terms where is_current limit 1;
  if v_term is null then
    raise exception 'There is no current term. Set the current term first (Set up > Current term).';
  end if;

  delete from public.fee_items where term_id = v_term;
  insert into public.fee_items (class_id, term_id, name, amount)
  select id, v_term, 'School fees',
         case when lower(btrim(name)) in ('nursery 1', 'nursery 2', 'kg 1', 'kg 2') then 345 else 355 end
  from public.classes;
  get diagnostics v_n = row_count;
  raise notice 'School fees set for % classes.', v_n;
end $$;

-- Check the result (this table shows each class and its fee):
select c.name as class, f.amount as fee
from public.fee_items f join public.classes c on c.id = f.class_id
where f.term_id = (select id from public.terms where is_current limit 1)
order by c.level_order;
