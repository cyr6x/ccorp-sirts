-- Demo Auth seed retired for production readiness.
-- This migration intentionally creates no users and contains no default password.
-- Create staff through the protected admin-create-user Edge Function after
-- bootstrapping the first ADMIN account in Supabase Auth.

do $$
begin
  raise notice 'Demo seed disabled: no default credentials created.';
end
$$;
