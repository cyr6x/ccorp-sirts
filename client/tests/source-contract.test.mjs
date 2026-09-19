import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url),'utf8');

test('development client is pinned only to isolated fresh Supabase', async () => {
  const source = await read('src/lib/supabaseClient.js');
  assert.match(source,/pvtissqcpskpxlduxuta\.supabase\.co/);
  assert.doesNotMatch(source,/tvjyllnfuptdcbirjvev\.supabase\.co/);
  assert.doesNotMatch(source,/service_role/i);
});

test('authentication fails closed when profile or role cannot be resolved', async () => {
  const source = await read('src/context/AuthContext.jsx');
  assert.match(source,/staff profile could not be loaded/);
  assert.match(source,/account has no assigned role/);
  assert.doesNotMatch(source,/role_id\s*\?\?\s*['"]SOC_ANALYST_L3/);
});

test('route guards protect reports audit and user management', async () => {
  const source = await read('src/App.jsx');
  assert.match(source,/capability="reports\.view"/);
  assert.match(source,/capability="audit\.view"/);
  assert.match(source,/capability="users\.manage"/);
});

test('admin page is scoped to role management and cannot create auth accounts client-side', async () => {
  const source = await read('src/pages/UsersPage.jsx');
  assert.doesNotMatch(source,/auth\.signUp/);
  assert.match(source,/Role management only/);
  assert.match(source,/role_id/);
});

test('asset and KB management use their own explicit capabilities', async () => {
  const assets = await read('src/pages/AssetsPage.jsx');
  const kb = await read('src/pages/KnowledgeBasePage.jsx');
  assert.match(assets,/assets\.manage/);
  assert.match(kb,/kb\.manage/);
});

test('login surface does not expose default credentials', async () => {
  const source = await read('src/pages/LoginPage.jsx');
  assert.doesNotMatch(source,/SIRTS-Test/);
  assert.doesNotMatch(source,/Demo@1234/);
  assert.doesNotMatch(source,/Admin@1234/);
});

test('incident detail uses tier-aware actions instead of a generic analyst role', async () => {
  const source = await read('src/pages/IncidentDetailPage.jsx');
  assert.match(source,/allowedStatusesFor/);
  assert.match(source,/assignmentTargetsFor/);
  assert.match(source,/canClaimIncident/);
  assert.match(source,/canEscalateIncident/);
  assert.doesNotMatch(source,/role === 'SOC_ANALYST'/);
});

test('all visible staff names use abbreviated display helper in key surfaces', async () => {
  for (const path of [
    'src/components/Navbar.jsx',
    'src/pages/UsersPage.jsx',
    'src/pages/IncidentsPage.jsx',
    'src/pages/IncidentDetailPage.jsx',
    'src/pages/AuditLogsPage.jsx',
    'src/pages/KnowledgeBasePage.jsx',
    'src/pages/KnowledgeBaseArticlePage.jsx',
  ]) {
    const source = await read(path);
    assert.match(source,/formatPersonName/,path);
  }
});


test('client incident creation does not write audit rows directly', async () => {
  const source = await read('src/pages/NewIncidentPage.jsx');
  assert.doesNotMatch(source, /from\('audit_log'\)\.insert/);
  assert.match(source, /server-side by database triggers/);
});
