-- T18: record a cash payment and give it the next receipt number (rules F3, F4, F6).
-- Receipt numbers look like R-2026-0001 and count up within the year of the payment date.
-- A lock makes sure two people recording at the same moment never get the same number.
-- Numbers of voided payments are never used again (the count looks at every payment, valid or void).
-- Runs with the caller's rights: Staff and Admin may record; the payment is under the caller's own name.

create function public.record_payment(p_student uuid, p_term uuid, p_amount numeric, p_paid_on date, p_note text)
returns table (payment_id uuid, receipt_no text)
language plpgsql security invoker as $$
declare
  v_year text;
  v_next integer;
  v_no text;
  v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'The amount must be more than zero';
  end if;
  if p_amount > 1000000 or scale(p_amount) > 2 then
    raise exception 'Enter a valid amount in cedis, with at most 2 decimals';
  end if;
  if p_paid_on is null or p_paid_on > current_date then
    raise exception 'The payment date cannot be in the future';
  end if;
  if p_paid_on < current_date - 366 then
    raise exception 'The payment date is too far in the past';
  end if;
  if not exists (select 1 from public.terms where id = p_term) then
    raise exception 'Term not found';
  end if;
  if not exists (select 1 from public.students where id = p_student and status = 'active') then
    raise exception 'Student not found, or not an active student';
  end if;
  if length(coalesce(p_note, '')) > 200 then
    raise exception 'The note can have at most 200 characters';
  end if;

  v_year := to_char(p_paid_on, 'YYYY');
  perform pg_advisory_xact_lock(hashtext('receipt_no_' || v_year));
  select coalesce(max(substring(p.receipt_no from '^R-' || v_year || '-(\d+)$')::integer), 0) + 1
    into v_next
    from public.payments p
   where p.receipt_no ~ ('^R-' || v_year || '-\d+$');
  v_no := 'R-' || v_year || '-' || lpad(v_next::text, 4, '0');

  insert into public.payments (student_id, term_id, amount, paid_on, receipt_no, received_by, note)
  values (p_student, p_term, p_amount, p_paid_on, v_no, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;

  return query select v_id, v_no;
end $$;
