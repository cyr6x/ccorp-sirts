-- Core Supabase auth/RLS hardening and live incident support.
-- Designed for the existing CCORP_SIRTS role model:
-- ADMIN, SOC_LEAD, SOC_ANALYST_L1, SOC_ANALYST_L2, SOC_ANALYST_L3.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create or replace function app_private.current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role_id
  from public.users
  where id = auth.uid()
  limit 1
$$;

revoke all on function app_private.current_role() from public;
grant execute on function app_private.current_role() to authenticated;

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.incidents enable row level security;
alter table public.comments enable row level security;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  changed_by uuid references public.users(id) on delete set null,
  field_changed text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id) on delete cascade,
  type text not null default 'SLA_BREACH',
  deadline_at timestamptz,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
alter table public.incident_updates enable row level security;
alter table public.notifications enable row level security;

drop policy if exists roles_read_all on public.roles;
drop policy if exists roles_write_admin on public.roles;
create policy roles_read_all
on public.roles for select to authenticated
using (true);

drop policy if exists users_read_own on public.users;
drop policy if exists users_update_own on public.users;
drop policy if exists users_read_all on public.users;
drop policy if exists users_write_admin on public.users;
create policy users_read_all
on public.users for select to authenticated
using (true);

create policy users_write_admin
on public.users for update to authenticated
using (app_private.current_role() = 'ADMIN')
with check (app_private.current_role() = 'ADMIN');

drop policy if exists incidents_insert_own on public.incidents;
drop policy if exists incidents_read_own on public.incidents;
drop policy if exists incidents_all_admin_lead on public.incidents;
drop policy if exists incidents_select_analyst on public.incidents;
drop policy if exists incidents_update_analyst on public.incidents;
drop policy if exists incidents_insert_analyst on public.incidents;

create policy incidents_read_visible
on public.incidents for select to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD')
  or created_by = auth.uid()
  or assigned_to = auth.uid()
);

create policy incidents_insert_own
on public.incidents for insert to authenticated
with check (created_by = auth.uid());

create policy incidents_update_visible
on public.incidents for update to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD')
  or created_by = auth.uid()
  or assigned_to = auth.uid()
)
with check (
  app_private.current_role() in ('ADMIN','SOC_LEAD')
  or created_by = auth.uid()
  or assigned_to = auth.uid()
);

create policy incidents_delete_admin
on public.incidents for delete to authenticated
using (app_private.current_role() = 'ADMIN');

drop policy if exists comments_read_related on public.comments;
drop policy if exists comments_read_all on public.comments;
drop policy if exists comments_insert on public.comments;

create policy comments_read_visible
on public.comments for select to authenticated
using (
  exists (
    select 1
    from public.incidents i
    where i.id = comments.incident_id
      and (
        app_private.current_role() in ('ADMIN','SOC_LEAD')
        or i.created_by = auth.uid()
        or i.assigned_to = auth.uid()
      )
  )
);

create policy comments_insert_own
on public.comments for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.incidents i
    where i.id = comments.incident_id
      and (
        app_private.current_role() in ('ADMIN','SOC_LEAD')
        or i.created_by = auth.uid()
        or i.assigned_to = auth.uid()
      )
  )
);

drop policy if exists audit_log_read on public.audit_log;
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_read
on public.audit_log for select to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD'));

create policy audit_log_insert
on public.audit_log for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists incident_updates_all_admin_lead on public.incident_updates;
drop policy if exists incident_updates_insert on public.incident_updates;
create policy incident_updates_read_visible
on public.incident_updates for select to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD')
  or exists (
    select 1
    from public.incidents i
    where i.id = incident_updates.incident_id
      and (i.created_by = auth.uid() or i.assigned_to = auth.uid())
  )
);

create policy incident_updates_insert_own
on public.incident_updates for insert to authenticated
with check (changed_by = auth.uid());

drop policy if exists notifications_read on public.notifications;
create policy notifications_read
on public.notifications for select to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD'));

create policy notifications_write
on public.notifications for all to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD'))
with check (app_private.current_role() in ('ADMIN','SOC_LEAD'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists set_incidents_updated_at on public.incidents;
create trigger set_incidents_updated_at
before update on public.incidents
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incidents'
  ) then
    alter publication supabase_realtime add table public.incidents;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'incident_updates'
  ) then
    alter publication supabase_realtime add table public.incident_updates;
  end if;
end
$$;
