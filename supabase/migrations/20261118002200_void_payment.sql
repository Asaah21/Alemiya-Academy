-- T20: void a payment that was recorded by mistake (rule F6). Admin only.
-- The payment stays on file with its receipt number, marked void, with the reason, who voided it and when.
-- A voided payment is no longer counted in balances or the daily cash, and cannot be changed again.
-- Runs with the caller's rights: only the Admin may update payments (see policies in migration 8).

create function public.void_payment(p_payment uuid, p_reason text)
returns void
language plpgsql security invoker as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_status text;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Only the Admin can void a payment';
  end if;
  if length(v_reason) < 3 then
    raise exception 'Give the reason for voiding this payment';
  end if;
  if length(v_reason) > 200 then
    raise exception 'The reason can have at most 200 characters';
  end if;
  select status into v_status from public.payments where id = p_payment;
  if v_status is null then
    raise exception 'Payment not found';
  end if;
  if v_status = 'void' then
    raise exception 'This payment is already voided';
  end if;
  update public.payments
     set status = 'void', void_reason = v_reason, voided_by = auth.uid(), voided_at = now()
   where id = p_payment;
end $$;
