export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  SOC_LEAD: 'SOC_LEAD',
  SOC_ANALYST_L1: 'SOC_ANALYST_L1',
  SOC_ANALYST_L2: 'SOC_ANALYST_L2',
  SOC_ANALYST_L3: 'SOC_ANALYST_L3',
});

export const ROLE_LABELS = Object.freeze({
  ADMIN: 'Administrator',
  SOC_LEAD: 'SOC Lead',
  SOC_ANALYST_L1: 'SOC Analyst L1',
  SOC_ANALYST_L2: 'SOC Analyst L2',
  SOC_ANALYST_L3: 'SOC Analyst L3',
});

const CAPABILITIES = Object.freeze({
  ADMIN: new Set([
    'incidents.view_all', 'incidents.create', 'incidents.assign_any',
    'incidents.resolve', 'incidents.close', 'incidents.delete',
    'comments.write', 'kb.manage', 'assets.manage',
    'reports.view', 'audit.view', 'users.manage',
  ]),
  SOC_LEAD: new Set([
    'incidents.view_all', 'incidents.create', 'incidents.assign_any',
    'incidents.resolve', 'incidents.close', 'comments.write',
    'kb.manage', 'assets.manage', 'reports.view', 'audit.view',
  ]),
  SOC_ANALYST_L3: new Set([
    'incidents.view_all', 'incidents.create', 'incidents.assign_any',
    'incidents.resolve', 'comments.write', 'kb.manage', 'assets.manage',
  ]),
  SOC_ANALYST_L2: new Set([
    'incidents.create', 'incidents.claim', 'incidents.escalate',
    'incidents.resolve', 'comments.write',
  ]),
  SOC_ANALYST_L1: new Set([
    'incidents.create', 'incidents.claim', 'comments.write',
  ]),
});

export const hasCapability = (role, capability) =>
  Boolean(CAPABILITIES[role]?.has(capability));

export const isSeniorIncidentRole = (role) =>
  [ROLES.ADMIN, ROLES.SOC_LEAD, ROLES.SOC_ANALYST_L3].includes(role);

export const allowedStatusesFor = (role) => {
  switch (role) {
    case ROLES.ADMIN:
    case ROLES.SOC_LEAD:
      return ['New', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
    case ROLES.SOC_ANALYST_L3:
    case ROLES.SOC_ANALYST_L2:
      return ['Assigned', 'In Progress', 'Resolved'];
    case ROLES.SOC_ANALYST_L1:
      return ['Assigned', 'In Progress'];
    default:
      return [];
  }
};

export const canWorkIncident = (role, incident, userId) => {
  if (!incident || !userId) return false;
  if (isSeniorIncidentRole(role)) return true;
  return incident.assigned_to === userId;
};

export const canClaimIncident = (role, incident) =>
  hasCapability(role, 'incidents.claim') && Boolean(incident) && !incident.assigned_to;

export const canEscalateIncident = (role, incident, userId) =>
  hasCapability(role, 'incidents.escalate') &&
  Boolean(incident) &&
  incident.assigned_to === userId;

export const canChangeStatus = (role, incident, userId) =>
  canWorkIncident(role, incident, userId) && allowedStatusesFor(role).length > 0;

export const assignmentTargetsFor = (role, users = []) => {
  if ([ROLES.ADMIN, ROLES.SOC_LEAD].includes(role)) return users;
  if (role === ROLES.SOC_ANALYST_L3) {
    return users.filter(user =>
      [ROLES.SOC_ANALYST_L1, ROLES.SOC_ANALYST_L2, ROLES.SOC_ANALYST_L3].includes(user.role?.name ?? user.role_id)
    );
  }
  if (role === ROLES.SOC_ANALYST_L2) {
    return users.filter(user =>
      [ROLES.SOC_ANALYST_L3, ROLES.SOC_LEAD].includes(user.role?.name ?? user.role_id)
    );
  }
  return [];
};

export const NAV_ITEMS = Object.freeze([
  { to: '/dashboard', label: 'Overview' },
  { to: '/incidents', label: 'Incidents' },
  { to: '/incidents/new', label: 'Create' },
  { to: '/knowledge-base', label: 'Knowledge' },
  { to: '/assets', label: 'Assets' },
  { to: '/reports', label: 'Reports', capability: 'reports.view' },
  { to: '/audit-logs', label: 'Audit', capability: 'audit.view' },
  { to: '/users', label: 'Users', capability: 'users.manage' },
]);

export const canAccessNavItem = (role, item) =>
  !item.capability || hasCapability(role, item.capability);
