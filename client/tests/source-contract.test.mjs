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
