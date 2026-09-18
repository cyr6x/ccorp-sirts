-- SIRTS production hardening and tiered SOC workflow migration.
-- Applies the live role model used by the application:
-- ADMIN, SOC_LEAD, SOC_ANALYST_L1, SOC_ANALYST_L2, SOC_ANALYST_L3.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create or replace function app_private.current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role_id from public.users where id = auth.uid() limit 1
$$;
revoke all on function app_private.current_role() from public, anon;
grant execute on function app_private.current_role() to authenticated;

insert into public.roles (id,name,permissions) values
  ('ADMIN','ADMIN','{}'::jsonb),
  ('SOC_LEAD','SOC_LEAD','{}'::jsonb),
  ('SOC_ANALYST_L1','SOC_ANALYST_L1','{}'::jsonb),
  ('SOC_ANALYST_L2','SOC_ANALYST_L2','{}'::jsonb),
  ('SOC_ANALYST_L3','SOC_ANALYST_L3','{}'::jsonb)
on conflict (id) do nothing;

-- Upgrade any legacy generic analyst profile before retiring the old role.
update public.users
set role_id='SOC_ANALYST_L3'
where role_id='SOC_ANALYST';

delete from public.roles
where id='SOC_ANALYST'
  and not exists (select 1 from public.users where role_id='SOC_ANALYST');

update public.roles
set permissions = case id
  when 'ADMIN' then '{"all_access":true,"audit_read":true,"reports_read":true,"users_manage":true,"incident_assign_any":true,"incident_close":true,"kb_manage":true,"assets_manage":true}'::jsonb
  when 'SOC_LEAD' then '{"audit_read":true,"reports_read":true,"incident_assign_any":true,"incident_close":true,"kb_manage":true,"assets_manage":true}'::jsonb
  when 'SOC_ANALYST_L3' then '{"incident_assign_any":true,"incident_resolve":true,"kb_manage":true,"assets_manage":true}'::jsonb
  when 'SOC_ANALYST_L2' then '{"can_assign_self":true,"can_escalate":true,"incident_resolve":true}'::jsonb
  when 'SOC_ANALYST_L1' then '{"can_assign_self":true}'::jsonb
  else permissions
end
where id in ('ADMIN','SOC_LEAD','SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3');

alter table public.users alter column role_id set default 'SOC_ANALYST_L3';

create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text not null,
  category text not null default 'OTHER',
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'OTHER',
  ip_address inet,
  os text,
  owner text,
  risk_level text not null default 'LOW',
  status text not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kb_articles enable row level security;
alter table public.assets enable row level security;

revoke all on public.kb_articles, public.assets from anon;
grant select, insert, update, delete on public.kb_articles, public.assets to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email, name, role_id, created_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'SOC_ANALYST_L3',
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.users.name, excluded.name);
  return new;
end
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.current_user_role() from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists set_incidents_updated_at on public.incidents;
create trigger set_incidents_updated_at before update on public.incidents
for each row execute function public.set_updated_at();

drop trigger if exists set_kb_articles_updated_at on public.kb_articles;
create trigger set_kb_articles_updated_at before update on public.kb_articles
for each row execute function public.set_updated_at();

drop trigger if exists set_assets_updated_at on public.assets;
create trigger set_assets_updated_at before update on public.assets
for each row execute function public.set_updated_at();

do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname='public'
      and tablename in ('roles','users','incidents','comments','audit_log','incident_updates','notifications','kb_articles','assets')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy roles_read_all on public.roles for select to authenticated using (true);
create policy users_read_all on public.users for select to authenticated using (true);
create policy users_update_admin on public.users for update to authenticated
using (app_private.current_role()='ADMIN')
with check (app_private.current_role()='ADMIN');

create policy incidents_read_visible on public.incidents for select to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3','SOC_ANALYST_L2')
  or created_by=auth.uid()
  or assigned_to=auth.uid()
  or assigned_to is null
);

create policy incidents_insert_own on public.incidents for insert to authenticated
with check (created_by=auth.uid());

create policy incidents_update_visible on public.incidents for update to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
  or assigned_to=auth.uid()
  or (assigned_to is null and app_private.current_role() in ('SOC_ANALYST_L1','SOC_ANALYST_L2'))
)
with check (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
  or assigned_to=auth.uid()
  or (
    app_private.current_role()='SOC_ANALYST_L2'
    and exists (
      select 1 from public.users target
      where target.id=assigned_to
        and target.role_id in ('SOC_ANALYST_L3','SOC_LEAD')
    )
  )
);

create policy incidents_delete_admin on public.incidents for delete to authenticated
using (app_private.current_role()='ADMIN');

create policy comments_read_visible on public.comments for select to authenticated
using (
  exists (
    select 1 from public.incidents i
    where i.id=comments.incident_id
      and (
        app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
        or i.created_by=auth.uid()
        or i.assigned_to=auth.uid()
        or i.assigned_to is null
      )
  )
);

create policy comments_insert_own on public.comments for insert to authenticated
with check (
  user_id=auth.uid()
  and exists (
    select 1 from public.incidents i
    where i.id=comments.incident_id
      and (
        app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
        or i.created_by=auth.uid()
        or i.assigned_to=auth.uid()
        or i.assigned_to is null
      )
  )
);

create policy audit_log_read_privileged on public.audit_log for select to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD'));
create policy incident_updates_read_visible on public.incident_updates for select to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
  or exists (
    select 1 from public.incidents i
    where i.id=incident_updates.incident_id
      and (i.created_by=auth.uid() or i.assigned_to=auth.uid())
  )
);
create policy incident_updates_insert_own on public.incident_updates for insert to authenticated
with check (changed_by=auth.uid());

create policy notifications_read_lead on public.notifications for select to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD'));
create policy notifications_write_lead on public.notifications for update to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD'))
with check (app_private.current_role() in ('ADMIN','SOC_LEAD'));

create policy kb_read_all on public.kb_articles for select to authenticated using (true);
create policy kb_write_senior on public.kb_articles for all to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'))
with check (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'));

create policy assets_read_all on public.assets for select to authenticated using (true);
create policy assets_write_senior on public.assets for all to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'))
with check (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'));

create or replace function app_private.audit_incident_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor uuid := auth.uid();
begin
  if tg_op='INSERT' then
    insert into public.audit_log (incident_id,user_id,action,details)
    values (new.id,actor,'INCIDENT_CREATED','Incident created with severity '||coalesce(new.severity,'UNKNOWN'));
    insert into public.notifications (incident_id,type,deadline_at,notified)
    values (new.id,'KDPA_72H',new.created_at + interval '72 hours',false);
  elsif tg_op='UPDATE' then
    if new.status is distinct from old.status then
      insert into public.audit_log (incident_id,user_id,action,details)
      values (new.id,actor,'STATUS_CHANGED','Status changed: '||coalesce(old.status,'NULL')||' -> '||coalesce(new.status,'NULL'));
      insert into public.incident_updates (incident_id,changed_by,field_changed,old_value,new_value)
      values (new.id,actor,'status',old.status,new.status);
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      insert into public.audit_log (incident_id,user_id,action,details)
      values (new.id,actor,'ASSIGNMENT_CHANGED','Incident assignment updated');
      insert into public.incident_updates (incident_id,changed_by,field_changed,old_value,new_value)
      values (new.id,actor,'assigned_to',old.assigned_to::text,new.assigned_to::text);
    end if;
    if new.severity is distinct from old.severity then
      insert into public.audit_log (incident_id,user_id,action,details)
      values (new.id,actor,'SEVERITY_CHANGED','Severity changed: '||coalesce(old.severity,'NULL')||' -> '||coalesce(new.severity,'NULL'));
      insert into public.incident_updates (incident_id,changed_by,field_changed,old_value,new_value)
      values (new.id,actor,'severity',old.severity,new.severity);
    end if;
    if new.status in ('Resolved','Closed') and old.status not in ('Resolved','Closed') then
      update public.notifications set notified=true
      where incident_id=new.id and notified=false;
    end if;
  end if;
  return new;
end
$$;
revoke all on function app_private.audit_incident_change() from public, anon, authenticated;

drop trigger if exists audit_incident_change on public.incidents;
create trigger audit_incident_change after insert or update on public.incidents
for each row execute function app_private.audit_incident_change();

do $$
begin
  if not exists (select 1 from pg_constraint where conname='incidents_severity_check') then
    alter table public.incidents add constraint incidents_severity_check
      check (severity in ('CRITICAL','HIGH','MEDIUM','LOW'));
  end if;
  if not exists (select 1 from pg_constraint where conname='incidents_status_check') then
    alter table public.incidents add constraint incidents_status_check
      check (status in ('New','Assigned','In Progress','Resolved','Closed'));
  end if;
  if not exists (select 1 from pg_constraint where conname='assets_risk_level_check') then
    alter table public.assets add constraint assets_risk_level_check
      check (risk_level in ('CRITICAL','HIGH','MEDIUM','LOW'));
  end if;
  if not exists (select 1 from pg_constraint where conname='assets_status_check') then
    alter table public.assets add constraint assets_status_check
      check (status in ('ACTIVE','MONITORING','ISOLATED','RETIRED'));
  end if;
end $$;

create index if not exists incidents_created_at_idx on public.incidents(created_at desc);
create index if not exists incidents_status_idx on public.incidents(status);
create index if not exists incidents_severity_idx on public.incidents(severity);
create index if not exists incidents_assigned_to_idx on public.incidents(assigned_to);
create index if not exists comments_incident_id_idx on public.comments(incident_id,created_at);
create index if not exists audit_log_incident_id_idx on public.audit_log(incident_id,created_at desc);
create index if not exists incident_updates_incident_id_idx on public.incident_updates(incident_id,created_at desc);
create index if not exists kb_articles_category_idx on public.kb_articles(category,updated_at desc);
create index if not exists assets_status_idx on public.assets(status,risk_level);


-- Additional audit coverage for investigation notes and administrative modules.
create or replace function app_private.audit_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (incident_id,user_id,action,details)
  values (new.incident_id, auth.uid(), 'COMMENT_ADDED', 'Investigation note added');
  return new;
end
$$;
revoke all on function app_private.audit_comment_insert() from public, anon, authenticated;

drop trigger if exists audit_comment_insert on public.comments;
create trigger audit_comment_insert
after insert on public.comments
for each row execute function app_private.audit_comment_insert();

create or replace function app_private.audit_kb_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (user_id,action,details)
  values (
    auth.uid(),
    case tg_op
      when 'INSERT' then 'KB_ARTICLE_CREATED'
      when 'UPDATE' then 'KB_ARTICLE_UPDATED'
      else 'KB_ARTICLE_DELETED'
    end,
    'Knowledge base article: ' || coalesce(new.title, old.title, 'Unknown')
  );
  return coalesce(new, old);
end
$$;
revoke all on function app_private.audit_kb_change() from public, anon, authenticated;

drop trigger if exists audit_kb_change on public.kb_articles;
create trigger audit_kb_change
after insert or update or delete on public.kb_articles
for each row execute function app_private.audit_kb_change();

create or replace function app_private.audit_asset_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (user_id,action,details)
  values (
    auth.uid(),
    case tg_op
      when 'INSERT' then 'ASSET_CREATED'
      when 'UPDATE' then 'ASSET_UPDATED'
      else 'ASSET_DELETED'
    end,
    'Asset: ' || coalesce(new.name, old.name, 'Unknown')
  );
  return coalesce(new, old);
end
$$;
revoke all on function app_private.audit_asset_change() from public, anon, authenticated;

drop trigger if exists audit_asset_change on public.assets;
create trigger audit_asset_change
after insert or update or delete on public.assets
for each row execute function app_private.audit_asset_change();

create or replace function app_private.audit_user_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role_id is distinct from old.role_id then
    insert into public.audit_log (user_id,action,details)
    values (
      auth.uid(),
      'USER_ROLE_CHANGED',
      'Role updated for ' || coalesce(new.email, new.id::text) ||
      ': ' || coalesce(old.role_id,'NULL') || ' -> ' || coalesce(new.role_id,'NULL')
    );
  end if;
  return new;
end
$$;
revoke all on function app_private.audit_user_change() from public, anon, authenticated;

drop trigger if exists audit_user_change on public.users;
create trigger audit_user_change
after update on public.users
for each row execute function app_private.audit_user_change();
