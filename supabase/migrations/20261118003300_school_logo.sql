-- School logo. The logo is not private (it is printed on every report card and shown to parents), so it lives in a
-- public storage bucket. Only the Admin can add a file; files cannot be changed or deleted from the app.
-- The address of the current logo is kept in settings.logo_url.
do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('school-logo', 'school-logo', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
    execute $p$create policy school_logo_add on storage.objects for insert to authenticated
      with check (bucket_id = 'school-logo' and public.app_role() = 'admin')$p$;
  end if;
end $$;
