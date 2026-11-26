-- T31: the timetable is one document (PDF, picture or Word file) uploaded by the Admin for a whole term.
-- Admin and Staff can open it. Parents cannot (not asked for). Nothing is deleted: uploading a new file for a term
-- hides the older one, and the older file stays in storage.

create table public.timetables (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id),
  file_path text not null unique,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 200),
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 10485760),
  archived boolean not null default false,
  uploaded_by_name text,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);
create index timetables_term_idx on public.timetables (term_id, created_at desc);

create function public.timetables_set_uploader() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.uploaded_by_name := (select full_name from public.profiles where auth_user_id = auth.uid());
  return new;
end $$;
create trigger timetables_uploader before insert on public.timetables
  for each row execute function public.timetables_set_uploader();

alter table public.timetables enable row level security;
create policy timetables_read on public.timetables for select to authenticated
  using (public.app_role() in ('admin', 'staff'));
create policy timetables_admin_write on public.timetables for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create trigger timetables_history after update on public.timetables
  for each row execute function public.log_history();
create trigger timetables_no_delete before delete on public.timetables
  for each row execute function public.block_delete();

-- The private file store (Supabase Storage). Skipped where Storage does not exist (the test database).
-- Only the Admin can add files; Admin and Staff can read them; nobody can change or delete a stored file.
do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('timetables', 'timetables', false, 10485760)
    on conflict (id) do nothing;
    execute $p$create policy timetable_files_read on storage.objects for select to authenticated
      using (bucket_id = 'timetables' and public.app_role() in ('admin', 'staff'))$p$;
    execute $p$create policy timetable_files_add on storage.objects for insert to authenticated
      with check (bucket_id = 'timetables' and public.app_role() = 'admin')$p$;
  end if;
end $$;
