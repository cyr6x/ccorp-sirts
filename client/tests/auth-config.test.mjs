import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('local Supabase configuration disables public signup', async () => {
  const config = await readFile(new URL('../../supabase/config.toml', import.meta.url), 'utf8');
  assert.match(config, /\[auth\][\s\S]*enable_signup\s*=\s*false/);
});
