-- Follow Supabase's supported Auth-trigger pattern. Keeping this function in
-- public avoids Auth service schema-resolution failures, while explicit
-- revokes prevent it becoming a callable privileged API endpoint.
drop trigger if exists on_auth_user_created on auth.users;

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
    btrim(new.raw_user_meta_data->>'first_name'),
    btrim(new.raw_user_meta_data->>'last_name'),
    null
  );
  return new;
end
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop function if exists app_private.handle_new_user();
