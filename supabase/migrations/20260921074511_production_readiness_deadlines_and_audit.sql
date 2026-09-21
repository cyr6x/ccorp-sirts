begin;

-- A notification is a tracker record, not proof that an external notification
-- was sent. Keep lifecycle state separate from the historic notified flag.
alter table public.notifications
  add column if not exists state text not null default 'PENDING',
  add column if not exists cancelled_at timestamptz,
  add column if not exists notified_at timestamptz;

alter table public.notifications
  drop constraint if exists notifications_state_check;
alter table public.notifications
  add constraint notifications_state_check
  check (state in ('PENDING','SENT','CANCELLED'));

update public.notifications
set state = case when notified then 'SENT' else 'PENDING' end,
    notified_at = case when notified then coalesce(notified_at, created_at) else null end;

-- Terminal incidents must not remain as active pending deadlines. Existing
-- notification rows are retained as evidence rather than deleted.
update public.notifications notification
set state = 'CANCELLED',
    cancelled_at = coalesce(notification.cancelled_at, now()),
    notified = false,
    notified_at = null
from public.incidents incident
where incident.id = notification.incident_id
  and incident.status in ('Resolved','Closed')
  and notification.state = 'PENDING';

create index if not exists notifications_pending_deadline_idx
  on public.notifications(state, deadline_at)
  where state = 'PENDING';

-- Browser clients never need to create, change or delete deadline records.
revoke insert, update, delete on public.notifications from authenticated;
drop policy if exists notifications_manage on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));

-- Preserve the audit row for any trusted maintenance delete, while preventing
-- hard deletion through the browser/API role. Archived closure is the normal
-- operational record lifecycle.
revoke delete on public.incidents from authenticated;
drop policy if exists incidents_delete on public.incidents;

create or replace function app_private.write_audit_event(
  p_action text,
  p_details jsonb default '{}'::jsonb,
  p_incident_id uuid default null,
  p_actor_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := coalesce(p_actor_id, auth.uid());
  actor_role text;
begin
  select role_id into actor_role from public.users where id = actor_id;
  insert into public.audit_log(incident_id,user_id,action,details)
  values (
    p_incident_id,
    actor_id,
    p_action,
    (coalesce(p_details, '{}'::jsonb) || jsonb_build_object('actor_id',actor_id,'actor_role',actor_role))::text
  );
end
$$;
revoke all on function app_private.write_audit_event(text,jsonb,uuid,uuid) from public;

create or replace function app_private.audit_incident() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  field_name text;
  audit_action text;
begin
  if tg_op = 'INSERT' then
    perform app_private.write_audit_event(
      'INCIDENT_CREATED',
      jsonb_build_object('incident_id',new.id,'title',new.title,'severity',new.severity,'status',new.status),
      new.id
    );
  else
    audit_action := case
      when new.status is distinct from old.status and new.status = 'Resolved' then 'RESOLVED'
      when new.status is distinct from old.status and new.status = 'Closed' then 'CLOSED'
      when new.status is distinct from old.status then 'STATUS_CHANGED'
      when new.assigned_to is distinct from old.assigned_to then 'ASSIGNED'
      when new.severity is distinct from old.severity then 'SEVERITY_CHANGED'
      else 'INCIDENT_UPDATED'
    end;
    perform app_private.write_audit_event(
      audit_action,
      jsonb_build_object(
        'incident_id',new.id,
        'title',new.title,
        'before',jsonb_build_object('status',old.status,'assigned_to',old.assigned_to,'severity',old.severity),
        'after',jsonb_build_object('status',new.status,'assigned_to',new.assigned_to,'severity',new.severity)
      ),
      new.id
    );
    foreach field_name in array array['status','assigned_to','severity'] loop
      if to_jsonb(new)->>field_name is distinct from to_jsonb(old)->>field_name then
        insert into public.incident_updates(incident_id,changed_by,field_changed,old_value,new_value)
        values(new.id,auth.uid(),field_name,to_jsonb(old)->>field_name,to_jsonb(new)->>field_name);
      end if;
    end loop;
  end if;
  return new;
end
$$;
revoke all on function app_private.audit_incident() from public;

create or replace function app_private.audit_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.write_audit_event(
    'COMMENT_ADDED',
    jsonb_build_object('comment_id',new.id,'body_length',length(new.body)),
    new.incident_id
  );
  return new;
end
$$;
revoke all on function app_private.audit_comment() from public;

create function app_private.audit_incident_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.write_audit_event(
    'INCIDENT_DELETED',
    jsonb_build_object('incident_id',old.id,'title',old.title,'severity',old.severity,'status',old.status),
    old.id
  );
  return old;
end
$$;
revoke all on function app_private.audit_incident_delete() from public;
create trigger audit_incident_delete before delete on public.incidents
for each row execute function app_private.audit_incident_delete();

create function app_private.audit_user_role_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role_id is distinct from old.role_id then
    perform app_private.write_audit_event(
      case when new.role_id is null then 'USER_ROLE_REMOVED' else 'USER_ROLE_CHANGED' end,
      jsonb_build_object('subject_user_id',new.id,'subject_email',new.email,'before_role',old.role_id,'after_role',new.role_id)
    );
  end if;
  return new;
end
$$;
revoke all on function app_private.audit_user_role_change() from public;
create trigger audit_user_role_change after update of role_id on public.users
for each row execute function app_private.audit_user_role_change();

create function app_private.audit_asset_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous_row jsonb;
  current_row jsonb;
  asset_id uuid;
begin
  if tg_op = 'DELETE' then
    asset_id := old.id;
    previous_row := to_jsonb(old) - 'updated_at';
    current_row := null;
  elsif tg_op = 'INSERT' then
    asset_id := new.id;
    previous_row := null;
    current_row := to_jsonb(new) - 'updated_at';
  else
    asset_id := new.id;
    previous_row := to_jsonb(old) - 'updated_at';
    current_row := to_jsonb(new) - 'updated_at';
  end if;
  if tg_op <> 'UPDATE' or current_row is distinct from previous_row then
    perform app_private.write_audit_event(
      case tg_op when 'INSERT' then 'ASSET_CREATED' when 'UPDATE' then 'ASSET_UPDATED' else 'ASSET_DELETED' end,
      jsonb_build_object('asset_id',asset_id,'before',previous_row,'after',current_row)
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function app_private.audit_asset_change() from public;
create trigger audit_asset_change after insert or update or delete on public.assets
for each row execute function app_private.audit_asset_change();

create function app_private.audit_kb_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous_row jsonb;
  current_row jsonb;
  article_id uuid;
begin
  if tg_op = 'DELETE' then
    article_id := old.id;
    previous_row := to_jsonb(old) - 'updated_at' - 'content';
    current_row := null;
  elsif tg_op = 'INSERT' then
    article_id := new.id;
    previous_row := null;
    current_row := to_jsonb(new) - 'updated_at' - 'content';
  else
    article_id := new.id;
    previous_row := to_jsonb(old) - 'updated_at' - 'content';
    current_row := to_jsonb(new) - 'updated_at' - 'content';
  end if;
  if tg_op <> 'UPDATE' or current_row is distinct from previous_row then
    perform app_private.write_audit_event(
      case tg_op when 'INSERT' then 'KB_ARTICLE_CREATED' when 'UPDATE' then 'KB_ARTICLE_UPDATED' else 'KB_ARTICLE_DELETED' end,
      jsonb_build_object('article_id',article_id,'before',previous_row,'after',current_row)
    );
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function app_private.audit_kb_change() from public;
create trigger audit_kb_change after insert or update or delete on public.kb_articles
for each row execute function app_private.audit_kb_change();

create function app_private.audit_incident_asset_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  linked_incident_id uuid;
  linked_asset_id uuid;
  linked_by uuid;
begin
  if tg_op = 'DELETE' then
    linked_incident_id := old.incident_id;
    linked_asset_id := old.asset_id;
    linked_by := coalesce(old.added_by, auth.uid());
  else
    linked_incident_id := new.incident_id;
    linked_asset_id := new.asset_id;
    linked_by := coalesce(new.added_by, auth.uid());
  end if;
  perform app_private.write_audit_event(
    case tg_op when 'INSERT' then 'INCIDENT_ASSET_LINKED' else 'INCIDENT_ASSET_UNLINKED' end,
    jsonb_build_object('incident_id',linked_incident_id,'asset_id',linked_asset_id),
    linked_incident_id,
    linked_by
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function app_private.audit_incident_asset_change() from public;
create trigger audit_incident_asset_change after insert or delete on public.incident_assets
for each row execute function app_private.audit_incident_asset_change();

create function app_private.audit_notification_state_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state is distinct from old.state then
    perform app_private.write_audit_event(
      'NOTIFICATION_STATE_CHANGED',
      jsonb_build_object('notification_id',new.id,'type',new.type,'before_state',old.state,'after_state',new.state,'deadline_at',new.deadline_at),
      new.incident_id
    );
  end if;
  return new;
end
$$;
revoke all on function app_private.audit_notification_state_change() from public;
create trigger audit_notification_state_change after update of state on public.notifications
for each row execute function app_private.audit_notification_state_change();

create function app_private.normalize_notification_state() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'SENT' then
    new.notified := true;
    new.notified_at := coalesce(new.notified_at, now());
    new.cancelled_at := null;
  elsif new.state = 'CANCELLED' then
    new.notified := false;
    new.notified_at := null;
    new.cancelled_at := coalesce(new.cancelled_at, now());
  else
    new.notified := false;
    new.notified_at := null;
    new.cancelled_at := null;
  end if;
  return new;
end
$$;
revoke all on function app_private.normalize_notification_state() from public;
create trigger normalize_notification_state before insert or update of state on public.notifications
for each row execute function app_private.normalize_notification_state();

drop trigger if exists sync_incident_sla on public.incidents;
drop function if exists app_private.sync_incident_sla();
create function app_private.sync_incident_deadlines() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  operational_start timestamptz;
begin
  if new.severity in ('CRITICAL','HIGH') and new.status not in ('Resolved','Closed') then
    operational_start := case
      when tg_op = 'UPDATE' and old.status in ('Resolved','Closed') then now()
      else new.created_at
    end;
    insert into public.notifications(incident_id,type,deadline_at,state)
    values(
      new.id,
      'SLA_DEADLINE',
      operational_start + case new.severity when 'CRITICAL' then interval '4 hours' else interval '8 hours' end,
      'PENDING'
    )
    on conflict (incident_id,type) do update
      set deadline_at = excluded.deadline_at,
          state = 'PENDING';

    -- This records a 72-hour tracker from the application's incident-record
    -- creation time. It is not a claim of legal notification compliance.
    insert into public.notifications(incident_id,type,deadline_at,state)
    values(new.id,'KDPA_NOTIFICATION',new.created_at + interval '72 hours','PENDING')
    on conflict (incident_id,type) do update
      set deadline_at = excluded.deadline_at,
          state = 'PENDING';
  else
    update public.notifications
    set state = 'CANCELLED'
    where incident_id = new.id
      and type in ('SLA_DEADLINE','KDPA_NOTIFICATION')
      and state = 'PENDING';
  end if;
  return new;
end
$$;
revoke all on function app_private.sync_incident_deadlines() from public;
create trigger sync_incident_deadlines
after insert or update of severity, status on public.incidents
for each row execute function app_private.sync_incident_deadlines();

-- Backfill both trackers for currently active high/critical incidents without
-- manufacturing new incident history. Terminal and lowered-severity records
-- remain preserved as cancelled evidence.
insert into public.notifications(incident_id,type,deadline_at,state)
select incident.id,
       'SLA_DEADLINE',
       incident.created_at + case incident.severity when 'CRITICAL' then interval '4 hours' else interval '8 hours' end,
       'PENDING'
from public.incidents incident
where incident.severity in ('CRITICAL','HIGH')
  and incident.status not in ('Resolved','Closed')
on conflict (incident_id,type) do update
  set deadline_at = excluded.deadline_at,
      state = 'PENDING';

insert into public.notifications(incident_id,type,deadline_at,state)
select incident.id,'KDPA_NOTIFICATION',incident.created_at + interval '72 hours','PENDING'
from public.incidents incident
where incident.severity in ('CRITICAL','HIGH')
  and incident.status not in ('Resolved','Closed')
on conflict (incident_id,type) do update
  set deadline_at = excluded.deadline_at,
      state = 'PENDING';

commit;
