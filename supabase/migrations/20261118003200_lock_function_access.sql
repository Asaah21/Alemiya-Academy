-- Security hardening. Supabase lets the "anon" role (anyone holding the public site key, without logging in)
-- run every function in the public schema by default. "revoke ... from public" in earlier migrations does not
-- remove that. Row-level security already stops anon from reading or changing data, but nobody who is not
-- logged in should be able to call these functions at all, so we take the permission away explicitly.
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
