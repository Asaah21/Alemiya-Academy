-- T30: notices. Admin and Staff post a notice for staff; the poster can also tick "show to parents".
-- Admin can edit or hide (archive) a notice. Notices are never deleted. Parents have no table access: they read
-- only notices marked for parents, through one narrow function.

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  audience text not null default 'staff' check (audience in ('staff', 'staff_and_parents')),
  archived boolean not null default false,
  posted_by_name text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
create index notices_created_idx on public.notices (created_at desc);

-- Remember who posted it by name, so the list does not need to read the profiles table.
create function public.notices_set_poster() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.posted_by_name := (select full_name from public.profiles where auth_user_id = auth.uid());
  return new;
end $$;
create trigger notices_poster before insert on public.notices
  for each row execute function public.notices_set_poster();

alter table public.notices enable row level security;
create policy notices_read on public.notices for select to authenticated
  using (public.app_role() in ('admin', 'staff'));
create policy notices_insert on public.notices for insert to authenticated
  with check (public.app_role() in ('admin', 'staff') and not archived);
create policy notices_admin_update on public.notices for update to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create trigger notices_history after update on public.notices
  for each row execute function public.log_history();
create trigger notices_no_delete before delete on public.notices
  for each row execute function public.block_delete();

-- What a parent sees: notices marked for parents, newest first.
create function public.parent_notices()
returns table (id uuid, title text, body text, created_at timestamptz, posted_by_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.parent_child_id() is null then
    raise exception 'Not available';
  end if;
  return query
    select n.id, n.title, n.body, n.created_at, n.posted_by_name
      from public.notices n
     where n.audience = 'staff_and_parents' and not n.archived
     order by n.created_at desc
     limit 30;
end $$;
revoke execute on function public.parent_notices() from public;
grant execute on function public.parent_notices() to authenticated;
