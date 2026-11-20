-- T22: what a logged-in parent is allowed to know about themselves (decision D8, rule C5).
-- Parents have NO direct access to any table: every table policy only lets Admin and Staff in. Parents get a few narrow
-- functions instead. This one says which child the parent's login belongs to. It returns nothing for anyone who is not
-- an active parent of an active student, so the app can tell a parent from a stranger.
-- It also notes the last login (at most once an hour) so the Admin can see who has used their code.

create function public.parent_me()
returns table (student_id uuid, full_name text, admission_no text, class_name text, school_name text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.parent_access pa
     set last_login = now()
   where pa.auth_user_id = auth.uid() and pa.active
     and (pa.last_login is null or pa.last_login < now() - interval '1 hour');
  return query
    select s.id, s.full_name, s.admission_no, coalesce(c.name, ''), coalesce((select st.school_name from public.settings st limit 1), '')
      from public.parent_access pa
      join public.students s on s.id = pa.student_id
      left join public.classes c on c.id = s.class_id
     where pa.auth_user_id = auth.uid() and pa.active and s.status = 'active';
end $$;

revoke execute on function public.parent_me() from public;
grant execute on function public.parent_me() to authenticated;
