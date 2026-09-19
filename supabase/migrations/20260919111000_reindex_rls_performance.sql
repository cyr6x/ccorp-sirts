-- SIRTS RLS/index performance pass.
-- Adds covering foreign-key indexes and avoids per-row auth.uid() evaluation
-- in the highest-traffic policies.

create index if not exists audit_log_user_id_idx
  on public.audit_log(user_id);
create index if not exists comments_user_id_idx
  on public.comments(user_id);
create index if not exists incident_updates_changed_by_idx
  on public.incident_updates(changed_by);
create index if not exists incidents_created_by_idx
  on public.incidents(created_by);
create index if not exists kb_articles_author_id_idx
  on public.kb_articles(author_id);
create index if not exists notifications_incident_id_idx
  on public.notifications(incident_id);
create index if not exists users_role_id_idx
  on public.users(role_id);

drop policy if exists incidents_insert_own on public.incidents;
create policy incidents_insert_own
on public.incidents for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists incidents_read_visible on public.incidents;
create policy incidents_read_visible
on public.incidents for select to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3','SOC_ANALYST_L2')
  or created_by = (select auth.uid())
  or assigned_to = (select auth.uid())
  or assigned_to is null
);

drop policy if exists incidents_update_visible on public.incidents;
create policy incidents_update_visible
on public.incidents for update to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
  or assigned_to = (select auth.uid())
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
      assigned_to = (select auth.uid())
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
    and assigned_to = (select auth.uid())
    and status in ('Assigned','In Progress')
  )
);

drop policy if exists comments_read_visible on public.comments;
create policy comments_read_visible
on public.comments for select to authenticated
using (
  exists (
    select 1
    from public.incidents i
    where i.id = comments.incident_id
      and (
        app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
        or i.created_by = (select auth.uid())
        or i.assigned_to = (select auth.uid())
        or i.assigned_to is null
      )
  )
);

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own
on public.comments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.incidents i
    where i.id = comments.incident_id
      and (
        app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
        or i.created_by = (select auth.uid())
        or i.assigned_to = (select auth.uid())
        or i.assigned_to is null
      )
  )
);

drop policy if exists incident_updates_read_visible on public.incident_updates;
create policy incident_updates_read_visible
on public.incident_updates for select to authenticated
using (
  app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3')
  or exists (
    select 1
    from public.incidents i
    where i.id = incident_updates.incident_id
      and (
        i.created_by = (select auth.uid())
        or i.assigned_to = (select auth.uid())
      )
  )
);

-- Split senior write policies by verb so SELECT has one permissive policy.
drop policy if exists kb_write_senior on public.kb_articles;
drop policy if exists kb_insert_senior on public.kb_articles;
drop policy if exists kb_update_senior on public.kb_articles;
drop policy if exists kb_delete_senior on public.kb_articles;
create policy kb_insert_senior
on public.kb_articles for insert to authenticated
with check (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'));
create policy kb_update_senior
on public.kb_articles for update to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'))
with check (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'));
create policy kb_delete_senior
on public.kb_articles for delete to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'));

drop policy if exists assets_write_senior on public.assets;
drop policy if exists assets_insert_senior on public.assets;
drop policy if exists assets_update_senior on public.assets;
drop policy if exists assets_delete_senior on public.assets;
create policy assets_insert_senior
on public.assets for insert to authenticated
with check (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'));
create policy assets_update_senior
on public.assets for update to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'))
with check (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'));
create policy assets_delete_senior
on public.assets for delete to authenticated
using (app_private.current_role() in ('ADMIN','SOC_LEAD','SOC_ANALYST_L3'));
