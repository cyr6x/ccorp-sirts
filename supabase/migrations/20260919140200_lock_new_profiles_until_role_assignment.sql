-- Supabase applies custom app_metadata after the auth.users INSERT trigger.
-- Create a locked profile first; only a trusted server process can activate it.
alter table public.users alter column role_id drop not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, first_name, last_name, role_id)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'first_name'), ''), 'Pending'),
    coalesce(nullif(btrim(new.raw_user_meta_data->>'last_name'), ''), 'User'),
    null
  );
  return new;
end
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop table if exists app_private.auth_trigger_diagnostics;
