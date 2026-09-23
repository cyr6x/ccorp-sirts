begin;

-- This is an internal human assessment, not an automated legal determination.
-- Legacy severity-based KDPA_NOTIFICATION rows are retained as historical data
-- but are no longer generated or used by the assessment UI.
create table public.breach_assessments (
  incident_id uuid primary key references public.incidents(id) on delete restrict,
  personal_data_involved boolean,
  unauthorised_access_or_acquisition boolean,
  real_risk_of_harm boolean,
  awareness_at timestamptz,
  outcome text not null default 'PENDING_REVIEW'
    check (outcome in ('PENDING_REVIEW','NOTIFICATION_REQUIRED','NOTIFICATION_NOT_REQUIRED')),
  assessment_reason text not null default '',
  breach_circumstances text not null default '',
  data_and_people_affected text not null default '',
  likely_consequences text not null default '',
  mitigation_measures text not null default '',
  responsible_role text not null default 'SOC_LEAD' check (responsible_role in ('ADMIN','SOC_LEAD')),
  contact_point text not null default '',
  deadline_at timestamptz,
  notification_state text check (notification_state in ('PENDING','SENT','CANCELLED')),
  notified_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index breach_assessments_deadline_idx on public.breach_assessments(deadline_at)
  where notification_state = 'PENDING';
alter table public.breach_assessments enable row level security;
revoke all on public.breach_assessments from public, anon;
grant select, insert, update on public.breach_assessments to authenticated;
create policy breach_assessments_read on public.breach_assessments for select to authenticated
  using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD')
    and exists (select 1 from public.incidents i where i.id = incident_id));
create policy breach_assessments_create on public.breach_assessments for insert to authenticated
  with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD')
    and exists (select 1 from public.incidents i where i.id = incident_id));
create policy breach_assessments_update on public.breach_assessments for update to authenticated
  using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD')
    and exists (select 1 from public.incidents i where i.id = incident_id))
  with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD')
    and exists (select 1 from public.incidents i where i.id = incident_id));

create function app_private.normalise_breach_assessment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    if new.incident_id is distinct from old.incident_id then
      raise exception 'An assessment cannot be moved to another incident';
    end if;
    if old.notification_state = 'SENT' and new.awareness_at is distinct from old.awareness_at then
      raise exception 'An already sent assessment cannot change its awareness time';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();

  if new.outcome = 'NOTIFICATION_REQUIRED' then
    if new.personal_data_involved is distinct from true
       or new.unauthorised_access_or_acquisition is distinct from true
       or new.real_risk_of_harm is distinct from true
       or new.awareness_at is null
       or btrim(new.assessment_reason) = '' then
      raise exception 'Required notification needs a qualifying assessment, awareness time and reason';
    end if;
    new.deadline_at := new.awareness_at + interval '72 hours';
    if tg_op = 'INSERT' or old.outcome <> 'NOTIFICATION_REQUIRED' then
      new.notification_state := 'PENDING';
      new.notified_at := null;
    elsif new.notification_state = 'SENT' then
      new.notified_at := case when old.notification_state = 'SENT'
        then old.notified_at else now() end;
    elsif new.notification_state = 'PENDING' then
      if old.notification_state = 'SENT' then
        raise exception 'Sent notification cannot be reverted to pending';
      end if;
      new.notified_at := null;
    else
      raise exception 'Required notification must be pending or sent';
    end if;
  else
    if new.outcome = 'NOTIFICATION_NOT_REQUIRED' and btrim(new.assessment_reason) = '' then
      raise exception 'A reason is required when notification is not required';
    end if;
    new.deadline_at := null;
    new.notification_state := case when tg_op = 'UPDATE' and old.notification_state is not null
      then 'CANCELLED' else null end;
    new.notified_at := case when tg_op = 'UPDATE' then old.notified_at else null end;
  end if;
  return new;
end $$;
revoke all on function app_private.normalise_breach_assessment() from public;
create trigger normalise_breach_assessment before insert or update on public.breach_assessments
  for each row execute function app_private.normalise_breach_assessment();

create function app_private.audit_breach_assessment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.write_audit_event(
    case when tg_op = 'INSERT' then 'BREACH_ASSESSMENT_CREATED'
         when new.notification_state is distinct from old.notification_state then 'BREACH_NOTIFICATION_STATE_CHANGED'
         when new.outcome is distinct from old.outcome then 'BREACH_ASSESSMENT_OUTCOME_CHANGED'
         else 'BREACH_ASSESSMENT_UPDATED' end,
    jsonb_build_object('incident_id',new.incident_id,'outcome',new.outcome,
      'notification_state',new.notification_state,'awareness_at',new.awareness_at,
      'deadline_at',new.deadline_at),
    new.incident_id
  );
  return new;
end $$;
revoke all on function app_private.audit_breach_assessment() from public;
create trigger audit_breach_assessment after insert or update on public.breach_assessments
  for each row execute function app_private.audit_breach_assessment();

-- Operational SLA remains on the original tracker. A resolved incident does
-- not by itself extinguish a separate human-assessed breach obligation.
create or replace function app_private.sync_incident_deadlines() returns trigger
language plpgsql security definer set search_path = '' as $$
declare operational_start timestamptz;
begin
  if new.severity in ('CRITICAL','HIGH') and new.status not in ('Resolved','Closed') then
    operational_start := case when tg_op = 'UPDATE' and old.status in ('Resolved','Closed')
      then now() else new.created_at end;
    insert into public.notifications(incident_id,type,deadline_at,state)
    values(new.id,'SLA_DEADLINE',operational_start + case new.severity
      when 'CRITICAL' then interval '4 hours' else interval '8 hours' end,'PENDING')
    on conflict (incident_id,type) do update
      set deadline_at = excluded.deadline_at, state = 'PENDING';
  else
    update public.notifications set state = 'CANCELLED'
    where incident_id = new.id and type = 'SLA_DEADLINE' and state = 'PENDING';
  end if;
  return new;
end $$;

commit;
