begin;

revoke execute on function public.create_incident_with_assets(text,text,text,text,inet,text,uuid[]) from anon, public;
grant execute on function public.create_incident_with_assets(text,text,text,text,inet,text,uuid[]) to authenticated;

commit;
