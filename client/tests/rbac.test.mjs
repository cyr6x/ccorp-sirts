import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  NAV_ITEMS,
  allowedStatusesFor,
  assignmentTargetsFor,
  canAccessNavItem,
  canClaimIncident,
  canEscalateIncident,
  canWorkIncident,
  hasCapability,
} from '../src/lib/rbac.js';

test('privileged navigation is role gated', () => {
  const reports = NAV_ITEMS.find(item => item.to === '/reports');
  const audit = NAV_ITEMS.find(item => item.to === '/audit-logs');
  const users = NAV_ITEMS.find(item => item.to === '/users');

  assert.equal(canAccessNavItem(ROLES.ADMIN, users), true);
  assert.equal(canAccessNavItem(ROLES.SOC_LEAD, users), false);
  assert.equal(canAccessNavItem(ROLES.SOC_ANALYST_L3, reports), false);
  assert.equal(canAccessNavItem(ROLES.SOC_LEAD, reports), true);
  assert.equal(canAccessNavItem(ROLES.SOC_ANALYST_L2, audit), false);
});

test('analyst tiers expose progressively broader workflows', () => {
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L1, 'incidents.claim'), true);
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L1, 'incidents.resolve'), false);

  assert.equal(hasCapability(ROLES.SOC_ANALYST_L2, 'incidents.escalate'), true);
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L2, 'incidents.resolve'), true);

  assert.equal(hasCapability(ROLES.SOC_ANALYST_L3, 'incidents.assign_any'), true);
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L3, 'kb.manage'), true);
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L3, 'audit.view'), false);

  assert.equal(hasCapability(ROLES.SOC_LEAD, 'audit.view'), true);
  assert.equal(hasCapability(ROLES.ADMIN, 'users.manage'), true);
});

test('status choices match the escalation model', () => {
  assert.deepEqual(allowedStatusesFor(ROLES.SOC_ANALYST_L1), ['Assigned', 'In Progress']);
  assert.deepEqual(allowedStatusesFor(ROLES.SOC_ANALYST_L2), ['Assigned', 'In Progress', 'Resolved']);
  assert.deepEqual(allowedStatusesFor(ROLES.SOC_ANALYST_L3), ['Assigned', 'In Progress', 'Resolved']);
  assert.deepEqual(allowedStatusesFor(ROLES.SOC_LEAD), ['New', 'Assigned', 'In Progress', 'Resolved', 'Closed']);
  assert.deepEqual(allowedStatusesFor(ROLES.ADMIN), ['New', 'Assigned', 'In Progress', 'Resolved', 'Closed']);
});

test('claim, ownership, and escalation rules are enforced', () => {
  const userId = 'analyst-1';
  const unassigned = { created_by: 'someone-else', assigned_to: null };
  const assigned = { created_by: 'someone-else', assigned_to: userId };

  assert.equal(canClaimIncident(ROLES.SOC_ANALYST_L1, unassigned), true);
  assert.equal(canClaimIncident(ROLES.SOC_ANALYST_L3, unassigned), false);
  assert.equal(canWorkIncident(ROLES.SOC_ANALYST_L1, assigned, userId), true);
  assert.equal(canWorkIncident(ROLES.SOC_ANALYST_L1, assigned, 'other'), false);
  assert.equal(canEscalateIncident(ROLES.SOC_ANALYST_L2, assigned, userId), true);
  assert.equal(canEscalateIncident(ROLES.SOC_ANALYST_L1, assigned, userId), false);

  const handedOff = { created_by: userId, assigned_to: 'senior-analyst' };
  assert.equal(canWorkIncident(ROLES.SOC_ANALYST_L1, handedOff, userId), false);
  assert.equal(canEscalateIncident(ROLES.SOC_ANALYST_L2, handedOff, userId), false);
});

test('assignment targets narrow by role', () => {
  const users = [
    { id:'a', role_id:ROLES.SOC_ANALYST_L1 },
    { id:'b', role_id:ROLES.SOC_ANALYST_L2 },
    { id:'c', role_id:ROLES.SOC_ANALYST_L3 },
    { id:'d', role_id:ROLES.SOC_LEAD },
    { id:'e', role_id:ROLES.ADMIN },
  ];

  assert.deepEqual(assignmentTargetsFor(ROLES.SOC_ANALYST_L2, users).map(user => user.id), ['c','d']);
  assert.deepEqual(assignmentTargetsFor(ROLES.SOC_ANALYST_L3, users).map(user => user.id), ['a','b','c']);
  assert.equal(assignmentTargetsFor(ROLES.SOC_ANALYST_L1, users).length, 0);
  assert.equal(assignmentTargetsFor(ROLES.SOC_LEAD, users).length, 5);
});
