-- Avoid evaluating overlapping permissive SELECT policies for management.
drop policy if exists kb_manage on public.kb_articles;
create policy kb_create on public.kb_articles for insert to authenticated
with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));
create policy kb_update on public.kb_articles for update to authenticated
using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'))
with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));
create policy kb_delete on public.kb_articles for delete to authenticated
using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));

drop policy if exists assets_manage on public.assets;
create policy assets_create on public.assets for insert to authenticated
with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));
create policy assets_update on public.assets for update to authenticated
using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'))
with check ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));
create policy assets_delete on public.assets for delete to authenticated
using ((select app_private.current_role()) in ('ADMIN','SOC_LEAD'));
