import Papa from 'papaparse';

export const REPORT_HEADINGS = [
  'Incident ID', 'Title', 'Category', 'Severity', 'Status',
  'Assignee', 'Source IP', 'Registered Assets', 'Unregistered Asset', 'Created', 'Resolved',
];

export function buildIncidentCsv(incidents) {
  const rows = incidents.map(incident => [
    incident.id, incident.title, incident.category, incident.severity, incident.status,
    incident.assigned_to_user?.name || 'Unassigned', incident.source_ip,
    (incident.incident_assets || []).map(link => [link.asset?.name, link.asset?.ip_address].filter(Boolean).join(' · ')).filter(Boolean).join('; '),
    incident.affected_asset,
    incident.created_at, incident.resolved_at,
  ]);

  return Papa.unparse(
    { fields: REPORT_HEADINGS, data: rows },
    { escapeFormulae: true },
  );
}
