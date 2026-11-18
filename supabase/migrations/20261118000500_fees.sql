-- T02 / migration 5: fee items and cash payments

create table public.fee_items (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id),
  term_id uuid not null references public.terms (id),
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
create index fee_items_class_term_idx on public.fee_items (class_id, term_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  term_id uuid not null references public.terms (id),
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  receipt_no text not null unique,                -- for example R-2026-0001, generated in T18
  received_by uuid references auth.users default auth.uid(),
  note text,
  status text not null default 'valid' check (status in ('valid', 'void')),
  void_reason text,
  voided_by uuid references auth.users,
  voided_at timestamptz,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  check (status = 'valid' or (void_reason is not null and length(trim(void_reason)) > 0))
);
create index payments_student_idx on public.payments (student_id);
create index payments_paid_on_idx on public.payments (paid_on);

-- Rule F6: a payment is never edited or deleted, only voided with a reason
create function public.protect_payments() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payments cannot be deleted. Void the payment instead.';
  end if;
  if old.status = 'void' then
    raise exception 'A voided payment cannot be changed.';
  end if;
  if (new.student_id, new.term_id, new.amount, new.paid_on, new.receipt_no, new.received_by, new.note)
     is distinct from
     (old.student_id, old.term_id, old.amount, old.paid_on, old.receipt_no, old.received_by, old.note) then
    raise exception 'A payment cannot be changed. Void it and record a new one.';
  end if;
  return new;
end $$;

create trigger payments_protect
before update or delete on public.payments
for each row execute function public.protect_payments();
