// Run only against the new project's URL and secret key, supplied via environment.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { validateBackendConfig } from '../src/lib/backendConfig.js';

const config = validateBackendConfig(process.env);
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret?.startsWith('sb_secret_')) throw new Error('Provide the new project secret key in SUPABASE_SECRET_KEY.');
const file = process.env.SIRTS_STAFF_FILE;
if (!file) throw new Error('Provide SIRTS_STAFF_FILE pointing to a private JSON roster.');
const roster = JSON.parse(await readFile(file, 'utf8'));
const roles = ['ADMIN','SOC_LEAD','SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3'];
if (!Array.isArray(roster) || !roster.length) throw new Error('The roster must be a nonempty array.');
for (const person of roster) {
  if (!person.first_name?.trim() || !person.last_name?.trim() || !person.email?.includes('@') ||
      !roles.includes(person.role_id) || typeof person.password !== 'string' || person.password.length < 12) {
    throw new Error('Each staff member requires first_name, last_name, email, role_id and a password of at least 12 characters.');
  }
}
const admin = createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
for (const person of roster) {
  const email = person.email.trim().toLowerCase();
  const existing = await admin.from('users').select('id,role_id').eq('email', email).maybeSingle();
  if (existing.error) throw new Error('Profile lookup failed. Check the new project and migration before proceeding.');
  if (existing.data && existing.data.role_id !== person.role_id) throw new Error('An existing account has a different role. Review it manually.');
  if (!existing.data) {
    const { error } = await admin.auth.admin.createUser({
      email, password: person.password, email_confirm: true,
      user_metadata: { first_name: person.first_name.trim(), last_name: person.last_name.trim() },
      app_metadata: { sirts_staff: true, sirts_role: person.role_id },
    });
    if (error) throw new Error(`Account creation failed (${error.code || error.status}). No existing accounts were modified.`);
  }
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password: person.password });
  if (signedIn.error) throw new Error('An account failed its real password login. No password was reset.');
  try {
    const profile = await client.from('users').select('role_id,first_name,last_name').eq('id',signedIn.data.user.id).single();
    if (profile.error || profile.data.role_id !== person.role_id) throw new Error('Profile/role verification failed.');
  } finally {
    const result = await client.auth.signOut({scope:'local'});
    if (result.error) throw new Error('Session sign-out verification failed.');
  }
  console.log(`Verified one ${person.role_id} account: password login, profile, role and sign-out.`);
}
