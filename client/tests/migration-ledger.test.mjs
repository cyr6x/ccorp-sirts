import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';

const hostedMigrationPrefixes = [
  '20260919135133_fresh_sirts_baseline.sql',
  '20260919135355_split_management_policies.sql',
  '20260919135856_allow_auth_profile_trigger.sql',
  '20260919135938_relocate_auth_profile_trigger.sql',
  '20260919140222_lock_new_profiles_until_role_assignment.sql',
  '20260919192638_complete_live_feature_wiring.sql',
  '20260919192801_index_incident_assets_added_by.sql',
  '20260919193710_enforce_one_kb_article_per_incident.sql',
];

test('repository migration history retains the hosted canonical versions', async () => {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = await readdir(dir);
  for (const migration of hostedMigrationPrefixes) assert(files.includes(migration), `missing hosted migration ${migration}`);
});
