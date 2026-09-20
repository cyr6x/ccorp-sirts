// Preview-only, repeatable SIRTS demonstration seed. Requires server credentials.
import { createClient } from '@supabase/supabase-js';
import { validateBackendConfig } from '../src/lib/backendConfig.js';
import { buildDemoData, DEMO_PROJECT_REF, DEMO_USERS } from './demo-data.mjs';

const config = validateBackendConfig(process.env);
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
const password = process.env.SIRTS_DEMO_PASSWORD;
const confirmation = process.env.SIRTS_DEMO_PROJECT_REF_CONFIRM?.trim();

if (config.projectRef !== DEMO_PROJECT_REF || confirmation !== DEMO_PROJECT_REF) {
  throw new Error(`Demo seeding is locked to ${DEMO_PROJECT_REF}; set SIRTS_DEMO_PROJECT_REF_CONFIRM to that exact preview project ref.`);
}
if (!secret?.startsWith('sb_secret_')) throw new Error('Provide the preview project secret in SUPABASE_SECRET_KEY.');
if (typeof password !== 'string' || password.length < 12) throw new Error('Provide a private SIRTS_DEMO_PASSWORD of at least 12 characters.');

const admin = createClient(config.url, secret, { auth: { persistSession:false, autoRefreshToken:false } });
const profileFields = 'id,email,first_name,last_name,role_id,created_at,updated_at';
const fail = (message, error) => { throw new Error(error ? `${message}: ${error.message}` : message); };
const stable = value => value && typeof value === 'object'
  ? JSON.stringify(value, Object.keys(value).sort())
  : JSON.stringify(value);

async function allAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage:1000 });
    if (error) fail('Auth user lookup failed', error);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function provisionDemoUsers() {
  const before = await admin.from('users').select(profileFields).order('id');
  if (before.error) fail('Existing profile snapshot failed', before.error);
  const demoEmails = new Set(DEMO_USERS.map(user => user.email));
  const protectedProfiles = before.data.filter(profile => !demoEmails.has(profile.email));
  const authUsers = await allAuthUsers();
  const ids = {};

  for (const person of DEMO_USERS) {
    const profile = before.data.find(item => item.email === person.email);
    const authUser = authUsers.find(item => item.email?.toLowerCase() === person.email);
    if (profile) {
      if (!authUser || authUser.id !== profile.id || profile.first_name !== person.first_name ||
          profile.last_name !== person.last_name || profile.role_id !== person.role_id) {
        fail(`Existing demo identity ${person.email} does not match the seed manifest; nothing was overwritten`);
      }
      ids[person.key] = profile.id;
      continue;
    }
    if (authUser) fail(`Auth identity ${person.email} exists without the expected profile; review it manually`);

    const created = await admin.auth.admin.createUser({
      email:person.email,
      password,
      email_confirm:true,
      user_metadata:{ first_name:person.first_name, last_name:person.last_name },
      app_metadata:{ sirts_staff:true, sirts_role:person.role_id, demo_account:true },
    });
    if (created.error) fail(`Demo account creation failed for ${person.email}`, created.error);
    const activated = await admin.from('users').update({ role_id:person.role_id })
      .eq('id',created.data.user.id).is('role_id',null).select(profileFields).single();
    if (activated.error) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      fail(`Profile activation failed for ${person.email}; the incomplete Auth account was removed`, activated.error);
    }
    ids[person.key] = created.data.user.id;
  }

  const after = await admin.from('users').select(profileFields).order('id');
  if (after.error) fail('Post-provision profile snapshot failed', after.error);
  for (const original of protectedProfiles) {
    const current = after.data.find(profile => profile.id === original.id);
    if (!current || stable(current) !== stable(original)) fail(`Pre-existing profile ${original.id} changed; stop and investigate`);
  }
  return ids;
}

function comparable(row) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !['created_at','updated_at','resolved_at'].includes(key)));
}

async function ensureRows(table, rows, keys = ['id']) {
  let inserted = 0;
  for (const row of rows) {
    let query = admin.from(table).select('*');
    for (const key of keys) query = query.eq(key,row[key]);
    const existing = await query.maybeSingle();
    if (existing.error) fail(`${table} lookup failed`, existing.error);
    if (existing.data) {
      for (const [key,value] of Object.entries(comparable(row))) {
        if (stable(existing.data[key]) !== stable(value)) fail(`${table} seed key ${keys.map(name => row[name]).join('/')} is occupied by different data; nothing was overwritten`);
      }
      continue;
    }
    const result = await admin.from(table).insert(row);
    if (result.error) fail(`${table} insert failed`, result.error);
    inserted += 1;
  }
  return inserted;
}

async function verifyRoleJourneys(data) {
  const incidentIds = data.incidents.map(row => row.id);
  const auditIds = data.audit_log.map(row => row.id);
  const expectedByUser = Object.fromEntries(DEMO_USERS.map(person => [person.key,
    data.incidents.filter(row => row.created_by === actorIds[person.key] || row.assigned_to === actorIds[person.key]).length
  ]));

  for (const person of DEMO_USERS) {
    const client = createClient(config.url,config.key,{ auth:{ persistSession:false,autoRefreshToken:false } });
    const login = await client.auth.signInWithPassword({ email:person.email, password });
    if (login.error) fail(`Password login verification failed for ${person.email}; existing passwords are never reset`, login.error);
    try {
      const profile = await client.from('users').select('id,role_id,first_name,last_name').eq('id',login.data.user.id).single();
      if (profile.error || profile.data.role_id !== person.role_id) fail(`Role verification failed for ${person.email}`, profile.error);
      const visible = await client.from('incidents').select('id').in('id',incidentIds);
      if (visible.error) fail(`Incident journey verification failed for ${person.email}`, visible.error);
      const expected = person.role_id === 'SOC_LEAD' ? incidentIds.length : expectedByUser[person.key];
      if (visible.data.length !== expected) fail(`Unexpected incident visibility for ${person.email}: expected ${expected}, received ${visible.data.length}`);
      const modules = await Promise.all([
        client.from('assets').select('id').in('id',data.assets.map(row => row.id)),
        client.from('kb_articles').select('id').in('id',data.kb_articles.map(row => row.id)),
        client.from('audit_log').select('id').in('id',auditIds),
      ]);
      if (modules.some(result => result.error)) fail(`Module read verification failed for ${person.email}`, modules.find(result => result.error)?.error);
      if (modules[0].data.length !== data.assets.length || modules[1].data.length !== data.kb_articles.length) fail(`Knowledge or asset visibility is incomplete for ${person.email}`);
      const expectedAudit = person.role_id === 'SOC_LEAD' ? auditIds.length : 0;
      if (modules[2].data.length !== expectedAudit) fail(`Audit visibility is incorrect for ${person.email}`);
    } finally {
      await client.auth.signOut({ scope:'local' });
    }
  }
}

const actorIds = await provisionDemoUsers();
const data = buildDemoData(actorIds);
const inserted = {};
inserted.assets = await ensureRows('assets',data.assets);
inserted.incidents = await ensureRows('incidents',data.incidents);
inserted.incident_assets = await ensureRows('incident_assets',data.incident_assets,['incident_id','asset_id']);
inserted.comments = await ensureRows('comments',data.comments);
inserted.incident_updates = await ensureRows('incident_updates',data.incident_updates);
inserted.audit_log = await ensureRows('audit_log',data.audit_log);
inserted.kb_articles = await ensureRows('kb_articles',data.kb_articles);

const terminalHighSeverity = data.incidents.filter(row => ['Resolved','Closed'].includes(row.status) && ['HIGH','CRITICAL'].includes(row.severity)).map(row => row.id);
if (terminalHighSeverity.length) {
  const result = await admin.from('notifications').update({ notified:true }).in('incident_id',terminalHighSeverity).eq('type','SLA_DEADLINE').eq('notified',false);
  if (result.error) fail('Terminal demonstration notification update failed', result.error);
}

await verifyRoleJourneys(data);
console.log(JSON.stringify({ result:'PASS', users:DEMO_USERS.length, totals:Object.fromEntries(Object.entries(data).map(([name,rows]) => [name,rows.length])), inserted }));
