-- T03 / migration 8: who can do what (decision D1 to D13, roles table in section 5 of the plan).
-- Roles live in public.profiles. A logged-in user with NO active profile can do nothing,
-- so even if public sign-up were left on by mistake, a stranger sees no data.
-- Parent policies are added later in T22.

alter table public.profiles add column email text;     -- shown on the Users screen

-- The caller's role: 'admin', 'staff', 'parent', or null (no profile or inactive).
-- security definer lets it read profiles without being blocked by profiles' own rules.
create function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where auth_user_id = auth.uid() and active
$$;

revoke all on function public.app_role() from public;
grant execute on function public.app_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin and Staff can read these tables. Only Admin can add, change or remove rows.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'academic_years', 'terms', 'classes', 'subjects', 'class_subjects',
    'grade_scale', 'staff', 'fee_items', 'results_publish', 'non_school_days', 'term_snapshots'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_role() in (''admin'', ''staff''))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.app_role() = ''admin'') with check (public.app_role() = ''admin'')',
      t || '_admin_write', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Students: Staff can add a new student (status active) but not edit one. Admin can do both.
-- ---------------------------------------------------------------------------
create policy students_read on public.students for select to authenticated
  using (public.app_role() in ('admin', 'staff'));
create policy students_insert on public.students for insert to authenticated
  with check (public.app_role() = 'admin' or (public.app_role() = 'staff' and status = 'active'));
create policy students_admin_update on public.students for update to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- Movement history: Staff can only record a new admission. Admin can record any movement.
create policy student_movements_read on public.student_movements for select to authenticated
  using (public.app_role() in ('admin', 'staff'));
create policy student_movements_insert on public.student_movements for insert to authenticated
  with check (public.app_role() = 'admin' or (public.app_role() = 'staff' and movement = 'new'));

-- ---------------------------------------------------------------------------
-- Day-to-day entry: Staff and Admin can add and save again (history keeps earlier values)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['attendance_weeks', 'attendance_entries', 'scores', 'report_remarks'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_role() in (''admin'', ''staff''))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_role() in (''admin'', ''staff''))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_role() in (''admin'', ''staff'')) with check (public.app_role() in (''admin'', ''staff''))',
      t || '_update', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Payments: Staff and Admin can record a payment under their own name; only Admin can void.
-- ---------------------------------------------------------------------------
create policy payments_read on public.payments for select to authenticated
  using (public.app_role() in ('admin', 'staff'));
create policy payments_insert on public.payments for insert to authenticated
  with check (
    public.app_role() in ('admin', 'staff')
    and status = 'valid'
    and received_by = auth.uid()
  );
create policy payments_admin_void on public.payments for update to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Admin only: staff attendance, parent access codes, history of corrections
-- ---------------------------------------------------------------------------
create policy staff_attendance_admin on public.staff_attendance for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy parent_access_admin on public.parent_access for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy history_admin_read on public.history for select to authenticated
  using (public.app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Profiles: everyone reads their own row; Admin reads all. Nobody writes from the browser:
-- users are created and changed only by the manage-users server function (service key).
-- ---------------------------------------------------------------------------
create policy profiles_read on public.profiles for select to authenticated
  using (auth_user_id = auth.uid() or public.app_role() = 'admin');
