import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIncidentCsv } from '../src/lib/reportExport.js';
import { createRequestGate, reportFilterKey } from '../src/lib/reportRequestState.js';

test('CSV export neutralizes formula-like values', () => {
  const csv = buildIncidentCsv([
    { id:'1', title:'=1+1', category:'OTHER', severity:'LOW', status:'New', assigned_to_user:{ name:'+SUM(A1:A2)' }, source_ip:'@host', affected_asset:'\tunsafe', created_at:'2026-09-21', resolved_at:null },
  ]);
  for (const value of ['=1+1', '+SUM(A1:A2)', '@host', '\tunsafe']) assert.ok(csv.includes(`'${value}`));
});

test('CSV export uses registered incident assets instead of only legacy asset text', () => {
  const csv = buildIncidentCsv([
    { id:'1', title:'Asset report', category:'OTHER', severity:'LOW', status:'New', assigned_to_user:null, source_ip:null, affected_asset:'legacy-host', created_at:'2026-09-21', resolved_at:null,
      incident_assets:[{ asset:{ name:'APP-01', ip_address:'10.10.0.8' } }, { asset:{ name:'DB-01', ip_address:null } }] },
  ]);
  assert.match(csv, /APP-01 · 10\.10\.0\.8; DB-01/);
  assert.match(csv, /legacy-host/);
});

test('only the latest report request may publish exportable results', () => {
  const gate = createRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  assert.notEqual(reportFilterKey({ range:'all', status:'Closed', severity:'CRITICAL', assignee:'' }), reportFilterKey({ range:'all', status:'Closed', severity:'', assignee:'' }));
});
