begin;

-- Link operational incidents to registered assets without removing the
-- legacy affected_asset text retained for imported or historical records.
create table public.incident_assets (
  incident_id uuid not null references public.incidents(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  added_by uuid references public.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (incident_id, asset_id)
);
create index incident_assets_asset_idx on public.incident_assets(asset_id);
alter table public.incident_assets enable row level security;
revoke all on public.incident_assets from anon, authenticated;
grant select, insert(incident_id,asset_id,added_by), delete on public.incident_assets to authenticated;
grant all on public.incident_assets to service_role;

create policy incident_assets_read on public.incident_assets
for select to authenticated
using (
  (select app_private.current_role()) is not null
  and exists (
    select 1 from public.incidents i
    where i.id = incident_assets.incident_id
  )
);

create policy incident_assets_create on public.incident_assets
for insert to authenticated
with check (
  added_by = (select auth.uid())
  and (select app_private.current_role()) is not null
  and exists (
    select 1 from public.incidents i
    where i.id = incident_assets.incident_id
      and (
        (select app_private.current_role()) in ('ADMIN','SOC_LEAD')
        or i.created_by = (select auth.uid())
        or i.assigned_to = (select auth.uid())
      )
  )
);

create policy incident_assets_delete on public.incident_assets
for delete to authenticated
using (
  exists (
    select 1 from public.incidents i
    where i.id = incident_assets.incident_id
      and (
        (select app_private.current_role()) in ('ADMIN','SOC_LEAD')
        or i.created_by = (select auth.uid())
        or i.assigned_to = (select auth.uid())
      )
  )
);

-- Preserve the existing knowledge-base model while adding traceability back
-- to the incident that produced an operational article.
alter table public.kb_articles
  add column tags text[] not null default '{}',
  add column source_incident_id uuid references public.incidents(id) on delete set null;
create index kb_source_incident_idx on public.kb_articles(source_incident_id);
grant insert(source_incident_id,tags), update(tags) on public.kb_articles to authenticated;

-- Audit incident comments inside the same transaction as the write.
create function app_private.audit_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  insert into public.audit_log(incident_id,user_id,action,details)
  values(
    new.incident_id,
    auth.uid(),
    'COMMENT_ADDED',
    jsonb_build_object('comment_id',new.id,'body_length',length(new.body))::text
  );
  return new;
end
$$;
revoke all on function app_private.audit_comment() from public;
create trigger audit_comment after insert on public.comments
for each row execute function app_private.audit_comment();

-- Replace generic update audit labels with truthful operational actions and
-- retain before/after values in the immutable incident_updates table.
create or replace function app_private.audit_incident() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  f text;
  audit_action text;
  audit_details text;
begin
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    audit_action := 'INCIDENT_CREATED';
    audit_details := jsonb_build_object('title',new.title,'severity',new.severity,'status',new.status)::text;
  else
    audit_action := case
      when new.status is distinct from old.status and new.status = 'Resolved' then 'RESOLVED'
      when new.status is distinct from old.status and new.status = 'Closed' then 'CLOSED'
      when new.status is distinct from old.status then 'STATUS_CHANGED'
      when new.assigned_to is distinct from old.assigned_to then 'ASSIGNED'
      when new.severity is distinct from old.severity then 'SEVERITY_CHANGED'
      else 'INCIDENT_UPDATED'
    end;
    audit_details := jsonb_build_object(
      'title',new.title,
      'before',jsonb_build_object('status',old.status,'assigned_to',old.assigned_to,'severity',old.severity),
      'after',jsonb_build_object('status',new.status,'assigned_to',new.assigned_to,'severity',new.severity)
    )::text;
  end if;

  insert into public.audit_log(incident_id,user_id,action,details)
  values(new.id,auth.uid(),audit_action,audit_details);

  if tg_op = 'UPDATE' then
    foreach f in array array['status','assigned_to','severity'] loop
      if to_jsonb(new)->>f is distinct from to_jsonb(old)->>f then
        insert into public.incident_updates(incident_id,changed_by,field_changed,old_value,new_value)
        values(new.id,auth.uid(),f,to_jsonb(old)->>f,to_jsonb(new)->>f);
      end if;
    end loop;
  end if;
  return new;
end
$$;

-- High and critical incidents receive one live SLA deadline record. Updating
-- severity recalculates the deadline; lowering severity removes a pending one.
create unique index notifications_incident_sla_unique
on public.notifications(incident_id,type);

create function app_private.sync_incident_sla() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.severity in ('CRITICAL','HIGH') then
    insert into public.notifications(incident_id,type,deadline_at,notified)
    values(
      new.id,
      'SLA_DEADLINE',
      new.created_at + case new.severity when 'CRITICAL' then interval '4 hours' else interval '8 hours' end,
      false
    )
    on conflict (incident_id,type) do update
      set deadline_at = excluded.deadline_at,
          notified = false;
  elsif tg_op = 'UPDATE' then
    delete from public.notifications
    where incident_id = new.id and type = 'SLA_DEADLINE' and notified = false;
  end if;
  return new;
end
$$;
revoke all on function app_private.sync_incident_sla() from public;
create trigger sync_incident_sla
after insert or update of severity on public.incidents
for each row execute function app_private.sync_incident_sla();

commit;
