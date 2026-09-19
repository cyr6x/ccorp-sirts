export const isManager = role => ['ADMIN', 'SOC_LEAD'].includes(role);
export function allowedStatuses(role, incident) {
  const next = {
    New: ['Assigned', 'In Progress'], Assigned: ['In Progress'],
    'In Progress': ['Resolved'], Resolved: ['Closed', 'In Progress'], Closed: ['In Progress'],
  }[incident.status] || [];
  return [incident.status, ...next.filter(status => {
    if (incident.status === 'Closed' && !isManager(role)) return false;
    if (status === 'Assigned') return isManager(role) && Boolean(incident.assigned_to);
    if (status === 'Resolved') return ['ADMIN', 'SOC_LEAD', 'SOC_ANALYST_L2', 'SOC_ANALYST_L3'].includes(role);
    if (status === 'Closed') return ['ADMIN', 'SOC_LEAD', 'SOC_ANALYST_L3'].includes(role);
    return true;
  })];
}
