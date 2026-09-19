-- Fresh projects only. No imported users, password hashes or operational rows.
-- Historical experiments remain available in Git, outside the migration chain.
begin;
create schema app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.roles (
  id text primary key,
  name text unique not null,
  permissions jsonb not null default '{}'::jsonb,
  check (id = name),
  check (id in ('ADMIN','SOC_LEAD','SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3'))
);
insert into public.roles values
 ('ADMIN','ADMIN','{"audit_read":true,"manage_users":true,"assign":true}'),
 ('SOC_LEAD','SOC_LEAD','{"audit_read":true,"assign":true}'),
 ('SOC_ANALYST_L1','SOC_ANALYST_L1','{"triage":true}'),
 ('SOC_ANALYST_L2','SOC_ANALYST_L2','{"triage":true,"resolve":true}'),
 ('SOC_ANALYST_L3','SOC_ANALYST_L3','{"triage":true,"resolve":true,"close":true}');

create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 email text unique not null,
 first_name text not null check (length(btrim(first_name)) > 0),
 last_name text not null check (length(btrim(last_name)) > 0),
 name text generated always as (first_name || ' ' || last_name) stored,
 role_id text not null references public.roles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index users_role_idx on public.users(role_id);

create table public.incidents (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(btrim(title)) > 0),
 description text,
 category text not null default 'OTHER' check (category in ('PHISHING','MALWARE','UNAUTHORISED_ACCESS','DOS','OTHER')),
 severity text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
 status text not null default 'New' check (status in ('New','Assigned','In Progress','Resolved','Closed')),
 source_ip inet,
 affected_asset text,
 created_by uuid references public.users(id) on delete set null default auth.uid(),
 assigned_to uuid references public.users(id) on delete set null,
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index incidents_creator_idx on public.incidents(created_by);
create index incidents_assignee_idx on public.incidents(assigned_to);
create index incidents_created_idx on public.incidents(created_at desc);
create index incidents_status_idx on public.incidents(status);

create table public.comments (
 id uuid primary key default gen_random_uuid(),
 incident_id uuid not null references public.incidents(id) on delete cascade,
 user_id uuid references public.users(id) on delete set null default auth.uid(),
 body text not null check (length(btrim(body)) > 0),
 created_at timestamptz not null default now()
);
create table public.incident_updates (
 id uuid primary key default gen_random_uuid(),
 incident_id uuid not null references public.incidents(id) on delete cascade,
 changed_by uuid references public.users(id) on delete set null,
 field_changed text not null,
 old_value text,
 new_value text,
 created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 incident_id uuid references public.incidents(id) on delete cascade,
 type text not null default 'SLA_BREACH',
 deadline_at timestamptz,
 notified boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.audit_log (
 id uuid primary key default gen_random_uuid(),
 incident_id uuid references public.incidents(id) on delete set null,
 user_id uuid references public.users(id) on delete set null,
 action text not null,
 details text,
 created_at timestamptz not null default now()
);
create table public.kb_articles (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(btrim(title)) > 0),
 summary text,
 content text not null check (length(btrim(content)) > 0),
 category text not null default 'OTHER',
 author_id uuid references public.users(id) on delete set null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.assets (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) > 0),
 type text not null default 'OTHER' check (type in ('SERVER','WORKSTATION','NETWORK_DEVICE','DATABASE','APPLICATION','OTHER')),
 ip_address inet,
 os text,
 owner text,
 risk_level text not null default 'LOW' check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
 status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','MAINTENANCE','DECOMMISSIONED')),
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index comments_incident_idx on public.comments(incident_id, created_at);
create index comments_user_idx on public.comments(user_id);
create index updates_incident_idx on public.incident_updates(incident_id, created_at);
create index updates_actor_idx on public.incident_updates(changed_by);
create index notifications_incident_idx on public.notifications(incident_id);
create index audit_incident_idx on public.audit_log(incident_id, created_at);
create index audit_actor_idx on public.audit_log(user_id);
create index kb_author_idx on public.kb_articles(author_id);

-- The sole RLS-bypassing lookup avoids users-policy recursion. It accepts no
-- caller-selected user ID and returns only the current authenticated user's role.
create function app_private.current_role() returns text
language sql stable security definer set search_path = '' as $$
 select role_id from public.users where id = (select auth.uid()) and auth.uid() is not null
$$;
revoke all on function app_private.current_role() from public;
grant execute on function app_private.current_role() to authenticated;

-- Staff provisioning must use Auth Admin createUser with trusted app_metadata.
-- User-editable user_metadata supplies names only, never privileges.
create function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.raw_app_meta_data->>'sirts_staff' is distinct from 'true' then
   raise exception 'Staff accounts must be provisioned by an administrator';
 end if;
 insert into public.users(id,email,first_name,last_name,role_id)
 values(new.id,new.email,btrim(new.raw_user_meta_data->>'first_name'),
        btrim(new.raw_user_meta_data->>'last_name'),new.raw_app_meta_data->>'sirts_role');
 return new;
end $$;
revoke all on function app_private.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users
for each row execute function app_private.handle_new_user();

create function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
revoke all on function app_private.touch_updated_at() from public;
do $$ declare t text; begin
 foreach t in array array['users','incidents','kb_articles','assets'] loop
 execute format('create trigger set_updated_at before update on public.%I for each row execute function app_private.touch_updated_at()',t);
 end loop;
end $$;

-- Column grants prevent identity/timestamp forgery; RLS controls row access.
do $$ declare t text; begin
 foreach t in array array['roles','users','incidents','comments','incident_updates','notifications','audit_log','kb_articles','assets'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage on schema public to authenticated;
grant update(role_id) on public.users to authenticated;
grant insert(title,description,category,severity,status,source_ip,affected_asset,created_by,assigned_to) on public.incidents to authenticated;
grant update(title,description,category,severity,status,source_ip,affected_asset,assigned_to) on public.incidents to authenticated;
grant delete on public.incidents to authenticated;
grant insert(incident_id,user_id,body) on public.comments to authenticated;
grant insert(title,summary,content,category,author_id), update(title,summary,content,category), delete on public.kb_articles to authenticated;
grant insert(name,type,ip_address,os,owner,risk_level,status,notes), update(name,type,ip_address,os,owner,risk_level,status,notes), delete on public.assets to authenticated;
grant insert(incident_id,type,deadline_at,notified), update(notified) on public.notifications to authenticated;

create policy roles_read on public.roles for select to authenticated
 using ((select app_private.current_role()) is not null);
create policy users_read on public.users for select to authenticated
 using (id = (select auth.uid()) or (select app_private.current_role()) is not null);
create policy users_admin_update on public.users for update to authenticated
 using ((select app_private.current_role()) = 'ADMIN' and id <> (select auth.uid()))
 with check ((select app_private.current_role()) = 'ADMIN' and id <> (select auth.uid()));

create policy incidents_read on public.incidents for select to authenticated
 using ((select app_private.current_role()) is not null and
 ((select app_private.current_role()) in ('ADMIN','SOC_LEAD') or created_by=(select auth.uid()) or assigned_to=(select auth.uid())));
create policy incidents_create on public.incidents for insert to authenticated
 with check ((select app_private.current_role()) is not null and created_by=(select auth.uid()) and status='New'
 and (assigned_to is null or (select app_private.current_role()) in ('ADMIN','SOC_LEAD')));
create policy incidents_update on public.incidents for update to authenticated
 using ((select app_private.current_role()) is not null and
 ((select app_private.current_role()) in ('ADMIN','SOC_LEAD') or created_by=(select auth.uid()) or assigned_to=(select auth.uid())))
 with check ((select app_private.current_role()) is not null and
 ((select app_private.current_role()) in ('ADMIN','SOC_LEAD') or created_by=(select auth.uid()) or assigned_to=(select auth.uid())));
create policy incidents_delete on public.incidents for delete to authenticated
 using ((select app_private.current_role())='ADMIN');
create policy comments_read on public.comments for select to authenticated
 using (exists(select 1 from public.incidents i where i.id=comments.incident_id));
create policy comments_create on public.comments for insert to authenticated
 with check (user_id=(select auth.uid()) and exists(select 1 from public.incidents i where i.id=comments.incident_id));
create policy updates_read on public.incident_updates for select to authenticated
 using (exists(select 1 from public.incidents i where i.id=incident_updates.incident_id));
create policy audit_read on public.audit_log for select to authenticated
 using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));
create policy notifications_manage on public.notifications for all to authenticated
 using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'))
 with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));
create policy kb_read on public.kb_articles for select to authenticated
 using ((select app_private.current_role()) is not null);
create policy kb_manage on public.kb_articles for all to authenticated
 using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'))
 with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));
create policy assets_read on public.assets for select to authenticated
 using ((select app_private.current_role()) is not null);
create policy assets_manage on public.assets for all to authenticated
 using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'))
 with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));

create function app_private.validate_incident_update() returns trigger
language plpgsql set search_path = '' as $$
declare r text; allowed boolean;
begin
 -- Only authenticated browser/API callers are subject to workflow restrictions.
 if current_user <> 'authenticated' then return new; end if;
 r := app_private.current_role();
 if new.assigned_to is distinct from old.assigned_to and r not in ('ADMIN','SOC_LEAD') then
   raise exception 'Only administrators and SOC leads can assign incidents';
 end if;
 if new.status is distinct from old.status then
   allowed := case old.status
     when 'New' then new.status in ('Assigned','In Progress')
     when 'Assigned' then new.status='In Progress'
     when 'In Progress' then new.status='Resolved'
     when 'Resolved' then new.status in ('Closed','In Progress')
     when 'Closed' then new.status='In Progress' and r in ('ADMIN','SOC_LEAD')
     else false end;
   if not allowed then raise exception 'Invalid incident status transition'; end if;
   if new.status='Assigned' and (r not in ('ADMIN','SOC_LEAD') or new.assigned_to is null) then
     raise exception 'Assign a staff member before setting Assigned';
   end if;
   if new.status='Resolved' and r not in ('ADMIN','SOC_LEAD','SOC_ANALYST_L2','SOC_ANALYST_L3') then
     raise exception 'L2 or higher is required to resolve incidents';
   end if;
   if new.status='Closed' and r not in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3') then
     raise exception 'L3 or higher is required to close incidents';
   end if;
   if new.status='Resolved' then new.resolved_at=now();
   elsif new.status='In Progress' then new.resolved_at=null; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.validate_incident_update() from public;
create trigger validate_incident_update before update on public.incidents
for each row execute function app_private.validate_incident_update();

-- Audit rows and status history are committed atomically with the incident.
create function app_private.audit_incident() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f text;
begin
 if auth.uid() is null then return new; end if;
 insert into public.audit_log(incident_id,user_id,action,details)
 values(new.id,auth.uid(),case when tg_op='INSERT' then 'INCIDENT_CREATED' else 'INCIDENT_UPDATED' end,
 case when tg_op='INSERT' then new.title else 'Incident updated: ' || new.title end);
 if tg_op='UPDATE' then
   foreach f in array array['status','assigned_to','severity'] loop
     if to_jsonb(new)->>f is distinct from to_jsonb(old)->>f then
       insert into public.incident_updates(incident_id,changed_by,field_changed,old_value,new_value)
       values(new.id,auth.uid(),f,to_jsonb(old)->>f,to_jsonb(new)->>f);
     end if;
   end loop;
 end if;
 return new;
end $$;
revoke all on function app_private.audit_incident() from public;
create trigger audit_incident after insert or update on public.incidents
for each row execute function app_private.audit_incident();

-- Supabase creates this publication; local SQL test harness creates it too.
alter publication supabase_realtime add table public.incidents, public.comments, public.incident_updates;
commit;
