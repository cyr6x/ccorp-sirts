-- Auth runs as supabase_auth_admin. Permit only the profile trigger entrypoint;
-- all other private functions remain inaccessible to that role.
grant usage on schema app_private to supabase_auth_admin;
grant execute on function app_private.handle_new_user() to supabase_auth_admin;
