import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  allowedStatusesFor,
  assignmentTargetsFor,
  canAccessNavItem,
  canClaimIncident,
  canEscalateIncident,
  hasCapability,
  NAV_ITEMS,
} from '../src/lib/rbac.js';

test('role capability matrix keeps privileged modules separated', () => {
  assert.equal(hasCapability(ROLES.ADMIN,'users.manage'),true);
  assert.equal(hasCapability(ROLES.SOC_LEAD,'users.manage'),false);
  assert.equal(hasCapability(ROLES.SOC_LEAD,'audit.view'),true);
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L3,'kb.manage'),true);
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L3,'assets.manage'),true);
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L2,'reports.view'),false);
  assert.equal(hasCapability(ROLES.SOC_ANALYST_L1,'incidents.close'),false);
});

test('status progression is constrained by analyst tier', () => {
  assert.deepEqual(allowedStatusesFor(ROLES.SOC_ANALYST_L1),['Assigned','In Progress']);
  assert.deepEqual(allowedStatusesFor(ROLES.SOC_ANALYST_L2),['Assigned','In Progress','Resolved']);
  assert.deepEqual(allowedStatusesFor(ROLES.SOC_ANALYST_L3),['Assigned','In Progress','Resolved']);
  assert.ok(allowedStatusesFor(ROLES.SOC_LEAD).includes('Closed'));
  assert.ok(allowedStatusesFor(ROLES.ADMIN).includes('Closed'));
});

test('L1 can claim only unassigned incidents', () => {
  assert.equal(canClaimIncident(ROLES.SOC_ANALYST_L1,{assigned_to:null}),true);
  assert.equal(canClaimIncident(ROLES.SOC_ANALYST_L1,{assigned_to:'user'}),false);
  assert.equal(canClaimIncident(ROLES.SOC_ANALYST_L3,{assigned_to:null}),false);
});

test('L2 escalation targets only L3 and Lead', () => {
  const users = [
    {id:'1',role_id:ROLES.SOC_ANALYST_L1},
    {id:'2',role_id:ROLES.SOC_ANALYST_L2},
    {id:'3',role_id:ROLES.SOC_ANALYST_L3},
    {id:'4',role_id:ROLES.SOC_LEAD},
    {id:'5',role_id:ROLES.ADMIN},
  ];
  assert.deepEqual(
    assignmentTargetsFor(ROLES.SOC_ANALYST_L2,users).map(user=>user.id),
    ['3','4']
  );
});

test('L2 escalation requires ownership or creation', () => {
  const incident = {assigned_to:'l2',created_by:'lead'};
  assert.equal(canEscalateIncident(ROLES.SOC_ANALYST_L2,incident,'l2'),true);
  assert.equal(canEscalateIncident(ROLES.SOC_ANALYST_L2,incident,'other'),false);
});

test('navigation items respect role capabilities', () => {
  const adminLabels = NAV_ITEMS.filter(item=>canAccessNavItem(ROLES.ADMIN,item)).map(item=>item.label);
  const l1Labels = NAV_ITEMS.filter(item=>canAccessNavItem(ROLES.SOC_ANALYST_L1,item)).map(item=>item.label);
  assert.ok(adminLabels.includes('Users'));
  assert.ok(adminLabels.includes('Audit'));
  assert.ok(!l1Labels.includes('Users'));
  assert.ok(!l1Labels.includes('Audit'));
  assert.ok(!l1Labels.includes('Reports'));
});
