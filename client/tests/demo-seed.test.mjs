import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData, DEMO_EMAIL_DOMAIN, DEMO_PROJECT_REF, DEMO_USERS } from '../scripts/demo-data.mjs';

const ids = Object.fromEntries(DEMO_USERS.map((user,index) => [user.key,`70000000-0000-4000-8000-${String(index + 1).padStart(12,'0')}`]));
const data = buildDemoData(ids,new Date('2026-09-20T12:00:00.000Z'));

test('demo identities are fictional, abbreviated and cover every operational tier', () => {
  assert.equal(DEMO_PROJECT_REF,'cudagansojpjtligqewe');
  assert.equal(DEMO_USERS.length,6);
  assert(DEMO_USERS.every(user => user.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)));
  assert(DEMO_USERS.every(user => /^[A-Z]\.$/.test(user.last_name)));
  assert.deepEqual(new Set(DEMO_USERS.map(user => user.role_id)),new Set(['SOC_LEAD','SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3']));
  assert(!DEMO_USERS.some(user => user.email === 'sarah@ccorp.local' || user.email === 'cyril@ccorp.local'));
});

test('demo records are interconnected, deterministic and exercise every visible module', () => {
  assert.equal(data.assets.length,10);
  assert.equal(data.incidents.length,12);
  assert.equal(data.incident_assets.length,12);
  assert.equal(data.kb_articles.length,6);
  assert(data.comments.length >= 10);
  assert(data.audit_log.length >= 30);
  assert(data.incident_updates.length >= 12);

  const uniqueIds = rows => assert.equal(new Set(rows.map(row => row.id)).size,rows.length);
  for (const rows of [data.assets,data.incidents,data.comments,data.incident_updates,data.audit_log,data.kb_articles]) uniqueIds(rows);
  const incidentIds = new Set(data.incidents.map(row => row.id));
  const assetIds = new Set(data.assets.map(row => row.id));
  const actorIds = new Set(Object.values(ids));
  assert(data.incident_assets.every(row => incidentIds.has(row.incident_id) && assetIds.has(row.asset_id) && actorIds.has(row.added_by)));
  assert(data.comments.every(row => incidentIds.has(row.incident_id) && actorIds.has(row.user_id)));
  assert(data.audit_log.every(row => incidentIds.has(row.incident_id) && actorIds.has(row.user_id)));
  assert(data.kb_articles.every(row => actorIds.has(row.author_id) && (!row.source_incident_id || incidentIds.has(row.source_incident_id))));
  assert.equal(new Set(data.kb_articles.filter(row => row.source_incident_id).map(row => row.source_incident_id)).size,data.kb_articles.filter(row => row.source_incident_id).length);
});

test('demo reporting data spans statuses, severities, categories and ninety days', () => {
  assert.deepEqual(new Set(data.incidents.map(row => row.status)),new Set(['New','Assigned','In Progress','Resolved','Closed']));
  assert.deepEqual(new Set(data.incidents.map(row => row.severity)),new Set(['LOW','MEDIUM','HIGH','CRITICAL']));
  assert.deepEqual(new Set(data.incidents.map(row => row.category)),new Set(['PHISHING','MALWARE','UNAUTHORISED_ACCESS','DOS','OTHER']));
  const timestamps = data.incidents.map(row => new Date(row.created_at).getTime());
  assert((Math.max(...timestamps) - Math.min(...timestamps)) / 86400000 > 80);
  assert(data.incidents.every(row => row.title.startsWith('SIM-') && row.description.startsWith('Fictional simulation:')));
});

test('all source addresses are documentation ranges and asset addresses are private', () => {
  assert(data.incidents.filter(row => row.source_ip).every(row => /^(192\.0\.2|198\.51\.100|203\.0\.113)\./.test(row.source_ip)));
  assert(data.assets.filter(row => row.ip_address).every(row => /^10\./.test(row.ip_address)));
});
