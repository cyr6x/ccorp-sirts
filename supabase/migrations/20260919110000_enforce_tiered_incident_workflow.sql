-- SIRTS tiered incident workflow enforcement.
-- Keeps the UI role matrix enforceable even when PostgREST is called directly.

drop policy if exists incidents_read_visible on public.incidents;
create policy incidents_read_visible
on public.incidents for select to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3','SOC_ANALYST_L2')
  or created_by = auth.uid()
  or assigned_to = auth.uid()
  or assigned_to is null
);

drop policy if exists incidents_update_visible on public.incidents;
create policy incidents_update_visible
on public.incidents for update to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
  or assigned_to = auth.uid()
  or (
    assigned_to is null
    and app_private.current_role() in ('SOC_ANALYST_L1','SOC_ANALYST_L2')
  )
)
with check (
  app_private.current_role() in ('ADMIN','SOC_LEAD')
  or (
    app_private.current_role() = 'SOC_ANALYST_L3'
    and status in ('Assigned','In Progress','Resolved')
    and (
      assigned_to is null
      or exists (
        select 1
        from public.users target
        where target.id = assigned_to
          and target.role_id in ('SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3')
      )
    )
  )
  or (
    app_private.current_role() = 'SOC_ANALYST_L2'
    and status in ('Assigned','In Progress','Resolved')
    and (
      assigned_to = auth.uid()
      or exists (
        select 1
        from public.users target
        where target.id = assigned_to
          and target.role_id in ('SOC_ANALYST_L3','SOC_LEAD')
      )
    )
  )
  or (
    app_private.current_role() = 'SOC_ANALYST_L1'
    and assigned_to = auth.uid()
    and status in ('Assigned','In Progress')
  )
);

create or replace function app_private.enforce_incident_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  role_name text := app_private.current_role();
  target_role text;
begin
  if role_name in ('ADMIN','SOC_LEAD') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.category is distinct from old.category
     or new.source_ip is distinct from old.source_ip
     or new.affected_asset is distinct from old.affected_asset then
    raise exception 'Incident core fields cannot be changed by this role'
      using errcode = '42501';
  end if;

  if new.assigned_to is not null then
    select role_id into target_role
    from public.users
    where id = new.assigned_to;
  end if;

  if role_name = 'SOC_ANALYST_L3' then
    if new.status not in ('Assigned','In Progress','Resolved') then
      raise exception 'L3 analysts cannot set this incident status'
        using errcode = '42501';
    end if;

    if new.assigned_to is not null
       and target_role not in ('SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3') then
      raise exception 'L3 analysts may assign only to analyst tiers'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if role_name = 'SOC_ANALYST_L2' then
    if old.assigned_to is distinct from auth.uid() then
      raise exception 'L2 analysts may update only incidents assigned to them'
        using errcode = '42501';
    end if;

    if new.status not in ('Assigned','In Progress','Resolved') then
      raise exception 'L2 analysts cannot set this incident status'
        using errcode = '42501';
    end if;

    if new.severity is distinct from old.severity then
      raise exception 'L2 analysts cannot change severity'
        using errcode = '42501';
    end if;

    if new.assigned_to is distinct from old.assigned_to
       and target_role not in ('SOC_ANALYST_L3','SOC_LEAD') then
      raise exception 'L2 escalation target must be L3 or SOC Lead'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if role_name = 'SOC_ANALYST_L1' then
    if new.status not in ('Assigned','In Progress') then
      raise exception 'L1 analysts cannot resolve or close incidents'
        using errcode = '42501';
    end if;

    if new.severity is distinct from old.severity then
      raise exception 'L1 analysts cannot change severity'
        using errcode = '42501';
    end if;

    if new.assigned_to is distinct from auth.uid() then
      raise exception 'L1 analysts may only claim incidents for themselves'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'Unknown SIRTS role'
    using errcode = '42501';
end
$$;

revoke all on function app_private.enforce_incident_workflow() from public, anon, authenticated;

drop trigger if exists enforce_incident_workflow on public.incidents;
create trigger enforce_incident_workflow
before update on public.incidents
for each row execute function app_private.enforce_incident_workflow();

-- Workflow history is trigger-owned and cannot be forged by an authenticated client.
drop policy if exists incident_updates_insert_own on public.incident_updates;
revoke insert, update, delete on public.incident_updates from authenticated;
grant select on public.incident_updates to authenticated;

revoke insert, delete on public.notifications from authenticated;
grant select, update on public.notifications to authenticated;
