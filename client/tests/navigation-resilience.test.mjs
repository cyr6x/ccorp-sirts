import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('primary navigation is hidden behind a hamburger drawer', async () => {
  const source = await read('src/components/Navbar.jsx');
  assert.match(source, /Open navigation menu/);
  assert.match(source, /nav-drawer/);
  assert.match(source, /Primary navigation/);
  assert.doesNotMatch(source, /flex items-center gap-1 flex-1 overflow-x-auto/);
});

test('header provides centered quick navigation search', async () => {
  const source = await read('src/components/Navbar.jsx');
  assert.match(source, /Quick navigation search/);
  assert.match(source, /Ctrl K/);
  assert.match(source, /SEARCH_ALIASES/);
  assert.match(source, /Search SIRTS or jump to a workspace/);
});

test('breadcrumb path always links back home', async () => {
  const source = await read('src/components/Navbar.jsx');
  assert.match(source, /to="\/dashboard"/);
  assert.match(source, />Home<\/Link>/);
  assert.match(source, /breadcrumbParts/);
});

test('staff names are compacted to first name and last initial', async () => {
  const source = await read('src/lib/userDisplay.js');
  assert.match(source, /parts\[parts\.length - 1\]\[0\]/);
  assert.match(source, /formatPersonName/);
});

test('render errors never collapse the whole workspace to a blank screen', async () => {
  const app = await read('src/App.jsx');
  const boundary = await read('src/components/ErrorBoundary.jsx');
  assert.match(app, /ErrorBoundary/);
  assert.match(boundary, /This view failed to render/);
  assert.match(boundary, /Go home/);
});

test('dashboard reports data failures instead of silently blanking', async () => {
  const dashboard = await read('src/pages/DashboardPage.jsx');
  assert.match(dashboard, /Some dashboard data could not be loaded/);
  assert.match(dashboard, /setError/);
});


test('development branch is pinned to the fresh isolated Supabase project', async () => {
  const client = await read('src/lib/supabaseClient.js');
  assert.match(client, /pvtissqcpskpxlduxuta\.supabase\.co/);
  assert.doesNotMatch(client, /tvjyllnfuptdcbirjvev\.supabase\.co/);
  assert.doesNotMatch(client, /oslthmbnukpkywapdkje\.supabase\.co/);
  assert.match(client, /supabaseConfigured/);
});
