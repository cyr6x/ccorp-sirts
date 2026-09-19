drop index if exists public.kb_source_incident_idx;

create unique index kb_source_incident_unique
on public.kb_articles(source_incident_id)
where source_incident_id is not null;
