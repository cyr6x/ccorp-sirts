begin;

-- Assignment remains management-only and now rejects a locked/unassigned
-- profile. This prevents incidents from being assigned to non-operational users.
create or replace function app_private.validate_incident_update() returns trigger
language plpgsql set search_path = '' as $$
declare r text; allowed boolean;
begin
 if current_user <> 'authenticated' then return new; end if;
 r := app_private.current_role();
 if new.assigned_to is not null and not exists (
   select 1 from public.users u join public.roles role on role.id = u.role_id
   where u.id = new.assigned_to
 ) then
   raise exception 'Assign an operational user with a valid role';
 end if;
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

-- A single transaction prevents a newly created incident from being left
-- without the selected registered-asset links. Duplicate asset IDs are ignored.
create or replace function public.create_incident_with_assets(
  p_title text,
  p_description text,
  p_category text,
  p_severity text,
  p_source_ip inet,
  p_affected_asset text,
  p_asset_ids uuid[] default '{}'::uuid[]
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare new_incident_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_description), '') is null then
    raise exception 'Title and description are required';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_asset_ids, '{}'::uuid[])) selected(asset_id)
    left join public.assets asset on asset.id = selected.asset_id and asset.status = 'ACTIVE'
    where asset.id is null
  ) then
    raise exception 'Only active registered assets can be linked to a new incident';
  end if;
  insert into public.incidents(title,description,category,severity,source_ip,affected_asset,status,created_by,assigned_to)
  values(p_title,p_description,p_category,p_severity,p_source_ip,nullif(btrim(p_affected_asset),''),'New',auth.uid(),null)
  returning id into new_incident_id;
  insert into public.incident_assets(incident_id,asset_id,added_by)
  select new_incident_id, selected.asset_id, auth.uid()
  from (select distinct asset_id from unnest(coalesce(p_asset_ids, '{}'::uuid[])) selected(asset_id)) selected;
  return new_incident_id;
end $$;
revoke all on function public.create_incident_with_assets(text,text,text,text,inet,text,uuid[]) from public;
grant execute on function public.create_incident_with_assets(text,text,text,text,inet,text,uuid[]) to authenticated;

commit;
