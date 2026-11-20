-- T19: what each active student owes, has paid, and still owes for a term, plus arrears from earlier terms.
-- owed = total of the fee items set for the student's current class and that term (rule F2).
-- paid = valid payments only; voided payments are ignored (rule F6).
-- arrears = the same sum (owed minus paid) over every term that started before this one, using the student's
--   current class for the fees. A negative number means the student has paid ahead.
-- Totals are worked out here so a big school never hits the 1000-row limit on the phone.
-- Runs with the caller's rights (Staff and Admin may both read fees and payments).

create function public.fee_balances(p_term uuid, p_class uuid default null)
returns table (student_id uuid, admission_no text, full_name text, class_id uuid, owed numeric, paid numeric, balance numeric, arrears numeric)
language sql stable security invoker as $$
  with this_term as (select start_date from public.terms where id = p_term),
  fees as (select fi.class_id, fi.term_id, sum(fi.amount) as total from public.fee_items fi group by fi.class_id, fi.term_id),
  pay as (select py.student_id, py.term_id, sum(py.amount) as total from public.payments py where py.status = 'valid' group by py.student_id, py.term_id)
  select s.id, s.admission_no, s.full_name, s.class_id,
         coalesce(f.total, 0), coalesce(p.total, 0), coalesce(f.total, 0) - coalesce(p.total, 0),
         coalesce((
           select sum(coalesce(f2.total, 0) - coalesce(p2.total, 0))
             from public.terms t2
             left join fees f2 on f2.class_id = s.class_id and f2.term_id = t2.id
             left join pay p2 on p2.student_id = s.id and p2.term_id = t2.id
            where t2.start_date < (select start_date from this_term)
         ), 0)
    from public.students s
    left join fees f on f.class_id = s.class_id and f.term_id = p_term
    left join pay p on p.student_id = s.id and p.term_id = p_term
   where s.status = 'active' and (p_class is null or s.class_id = p_class)
   order by s.full_name
$$;
