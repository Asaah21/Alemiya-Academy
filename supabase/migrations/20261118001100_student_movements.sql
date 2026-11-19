-- T09: moving a student out (transfer, withdrawal, graduation) or bringing one back, with date and reason.
-- Status change and history record are saved together, so they can never disagree.

-- How a new student joined: a new admission or a transfer in from another school (rule S3).
alter table public.students
  add column joined_as text not null default 'new' check (joined_as in ('new', 'transfer_in'));

create or replace function public.record_new_admission() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_term uuid;
begin
  select id into v_term from public.terms where is_current limit 1;
  if v_term is not null then
    insert into public.student_movements (student_id, term_id, movement, moved_on, to_class_id, created_by)
    values (new.id, v_term, new.joined_as, coalesce(new.admitted_on, current_date), new.class_id, auth.uid());
  end if;
  return new;
end $$;

-- Runs with the caller's own rights, so only the Admin can change a student's status.
create function public.record_movement(
  p_student uuid, p_movement text, p_moved_on date, p_reason text
) returns void
language plpgsql security invoker as $$
declare
  v_status text;
  v_class uuid;
  v_term uuid;
  v_new_status text;
  v_rows integer;
begin
  select status, class_id into v_status, v_class from public.students where id = p_student;
  if not found then
    raise exception 'Student not found';
  end if;

  if p_movement in ('transfer_out', 'withdrawn', 'graduated') then
    if v_status <> 'active' then
      raise exception 'Only an active student can be moved out';
    end if;
    v_new_status := case p_movement
      when 'transfer_out' then 'transferred_out'
      when 'withdrawn' then 'withdrawn'
      else 'graduated' end;
  elsif p_movement = 'transfer_in' then
    if v_status = 'active' then
      raise exception 'This student is already active';
    end if;
    v_new_status := 'active';
  else
    raise exception 'Unknown movement';
  end if;

  if p_moved_on is null or p_moved_on > current_date then
    raise exception 'The date cannot be in the future';
  end if;
  if p_movement <> 'graduated' and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Give a reason';
  end if;

  select id into v_term from public.terms where is_current limit 1;
  if v_term is null then
    raise exception 'Set the current term first';
  end if;

  update public.students set status = v_new_status where id = p_student;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Only the Admin can change a student status';
  end if;

  insert into public.student_movements (student_id, term_id, movement, moved_on, reason, from_class_id, to_class_id)
  values (
    p_student, v_term, p_movement, p_moved_on, nullif(btrim(p_reason), ''),
    case when p_movement = 'transfer_in' then null else v_class end,
    case when p_movement = 'transfer_in' then v_class else null end
  );
end $$;

grant execute on function public.record_movement(uuid, text, date, text) to authenticated;
