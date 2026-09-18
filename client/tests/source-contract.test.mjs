import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('login surface contains no default or demo credentials', async () => {
  const login = await read('src/pages/LoginPage.jsx');
  assert.doesNotMatch(login, /Demo@1234|DEMO_ACCOUNTS|demo access/i);
  assert.match(login, /autoComplete="current-password"/);
});

test('admin user creation never signs up through the browser session', async () => {
  const users = await read('src/pages/UsersPage.jsx');
  assert.match(users, /admin-create-user/);
  assert.doesNotMatch(users, /auth\.signUp/);
  assert.match(users, /minLength=\{12\}/);
});

test('asset workflow uses database-approved lifecycle values', async () => {
  const assets = await read('src/pages/AssetsPage.jsx');
  assert.match(assets, /MONITORING/);
  assert.match(assets, /ISOLATED/);
  assert.match(assets, /RETIRED/);
  assert.doesNotMatch(assets, /DECOMMISSIONED|MAINTENANCE|INACTIVE/);
});

test('incident page exposes tier-aware workflow controls', async () => {
  const detail = await read('src/pages/IncidentDetailPage.jsx');
  assert.match(detail, /canClaimIncident/);
  assert.match(detail, /canEscalateIncident/);
  assert.match(detail, /assignmentTargetsFor/);
  assert.doesNotMatch(detail, /SOC_ANALYST'\s*&&/);
});

test('interactive neural background is pointer reactive and motion aware', async () => {
  const backdrop = await read('src/components/NeuralBackdrop.jsx');
  assert.match(backdrop, /pointermove/);
  assert.match(backdrop, /prefers-reduced-motion/);
  assert.match(backdrop, /POINTER_RADIUS/);
});

test('route guards protect reports, audit, and user management', async () => {
  const app = await read('src/App.jsx');
  assert.match(app, /capability="reports\.view"/);
  assert.match(app, /capability="audit\.view"/);
  assert.match(app, /capability="users\.manage"/);
});


test('active navigation does not mark Incidents and Create simultaneously', async () => {
  const navbar = await read('src/components/Navbar.jsx');
  assert.match(navbar, /location\.pathname !== '\/incidents\/new'/);
});

test('profile-load failure clears the authenticated Supabase session', async () => {
  const auth = await read('src/context/AuthContext.jsx');
  assert.match(auth, /await supabase\.auth\.signOut\(\)/);
});

test('audit filter covers final workflow event names', async () => {
  const audit = await read('src/pages/AuditLogsPage.jsx');
  for (const action of [
    'ASSIGNMENT_CHANGED',
    'SEVERITY_CHANGED',
    'KB_ARTICLE_CREATED',
    'ASSET_UPDATED',
    'USER_CREATED',
    'USER_ROLE_CHANGED',
  ]) {
    assert.match(audit, new RegExp(action));
  }
});


test('asset create normalises empty INET values instead of sending an empty string', async () => {
  const assets = await read('src/pages/AssetsPage.jsx');
  assert.match(assets, /ip_address:\s*form\.ip_address\.trim\(\) \|\| null/);
});

test('knowledge-base delete reports database failures', async () => {
  const article = await read('src/pages/KnowledgeBaseArticlePage.jsx');
  assert.match(article, /deleteError/);
  assert.match(article, /setError\(deleteError\.message\)/);
});

test('unsupported Tailwind opacity shorthands are not used on critical UI', async () => {
  for (const path of [
    'src/pages/LoginPage.jsx',
    'src/pages/IncidentDetailPage.jsx',
    'src/pages/NewIncidentPage.jsx',
    'src/pages/UsersPage.jsx',
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /(?:bg|border|text)-[a-z]+-\d+\/8\b/);
  }
});
