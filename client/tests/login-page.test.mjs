import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8');

test('login page keeps the authentication form without promotional noise', () => {
  assert.match(source, /onSubmit=\{handleSubmit\}/);
  assert.match(source, /id="login-email"/);
  assert.match(source, /id="login-password"/);
  assert.match(source, /Enter SOC Workspace/);

  assert.doesNotMatch(source, /login-hero/);
  assert.doesNotMatch(source, /Detect\./);
  assert.doesNotMatch(source, /enterprise-brandmark/);
});
