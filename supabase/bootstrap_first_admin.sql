-- Run ONCE, after migration 8, to make the headmaster the first Admin.
-- Before running:
--   1. In Supabase open Authentication > Users > Add user > Create new user.
--      Enter the headmaster's email and a password and tick "Auto Confirm User".
--   2. Replace the email and name below with the same email and the headmaster's name.
-- After this, the Admin creates all other users from the Users screen in the app.

insert into public.profiles (auth_user_id, full_name, role, email)
select id, 'HEADMASTER NAME HERE', 'admin', email
from auth.users
where email = 'HEADMASTER EMAIL HERE';

-- Check it worked: this should return one row with role = admin
select full_name, email, role, active from public.profiles;
