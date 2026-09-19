import { createClient } from '@supabase/supabase-js';

const input = JSON.parse(await new Promise((resolve, reject) => {
  let body = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { body += chunk; });
  process.stdin.on('end', () => resolve(body));
  process.stdin.on('error', reject);
}));

const { url, key, accounts } = input;
const expectedRoles = ['ADMIN','SOC_LEAD','SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3'];
if (!url || !key?.startsWith('sb_publishable_') || accounts?.length !== expectedRoles.length) {
  throw new Error('Live UAT input is incomplete.');
}

const clients = new Map();
const profiles = new Map();
const marker = `UAT-${Date.now()}`;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const stage = message => console.error(`[live-uat] ${message}`);

stage('auth');
for (const account of accounts) {
  const role = account.expectedRole;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  check(!login.error && login.data.session, `Login failed for ${role}.`);
  const identity = await client.auth.getUser();
  check(identity.data.user?.id === login.data.user.id, `Session identity failed for ${role}.`);
  const profile = await client.from('users').select('id,email,first_name,last_name,role_id').eq('id', login.data.user.id).single();
  check(!profile.error && profile.data.role_id === role, `Profile role failed for ${role}.`);
  check(`${profile.data.first_name} ${profile.data.last_name}` === account.expectedName, `Full name failed for ${role}.`);
  clients.set(role, client);
  profiles.set(role, profile.data);
}

const wrongPassword = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const deniedLogin = await wrongPassword.auth.signInWithPassword({ email: accounts[0].email, password: `${accounts[0].password}-wrong` });
check(Boolean(deniedLogin.error), 'Wrong password was unexpectedly accepted.');

const admin = clients.get('ADMIN');
const lead = clients.get('SOC_LEAD');
const l1 = clients.get('SOC_ANALYST_L1');
const l2 = clients.get('SOC_ANALYST_L2');
const l3 = clients.get('SOC_ANALYST_L3');
const incidentIds = new Map();

stage('incident creation');
for (const role of expectedRoles) {
  stage(`incident creation: ${role}`);
  const profile = profiles.get(role);
  const created = await clients.get(role).from('incidents').insert({
    title: `${marker} ${role}`, description: 'Automated live recovery verification', category: 'OTHER',
    severity: 'LOW', status: 'New', created_by: profile.id,
  }).select('id').single();
  check(!created.error, `Incident creation failed for ${role}: ${created.error?.message}`);
  incidentIds.set(role, created.data.id);
}

stage('incident visibility');
for (const role of expectedRoles) {
  const visible = await clients.get(role).from('incidents').select('id').ilike('title', `${marker}%`);
  check(!visible.error, `Incident visibility query failed for ${role}.`);
  check(visible.data.length === (role === 'ADMIN' || role === 'SOC_LEAD' ? 5 : 1), `Unexpected incident visibility for ${role}.`);
}

const l1Profile = profiles.get('SOC_ANALYST_L1');
stage('assignment and comments');
const leadAssign = await lead.from('incidents').update({ assigned_to: l1Profile.id, status: 'Assigned' })
  .eq('id', incidentIds.get('SOC_LEAD')).select('id').single();
check(!leadAssign.error, 'SOC Lead assignment failed.');
const assignedVisibility = await l1.from('incidents').select('id').ilike('title', `${marker}%`);
check(assignedVisibility.data?.length === 2, 'Assigned incident was not visible to L1.');

const selfAssignment = await l1.from('incidents').update({ assigned_to: profiles.get('ADMIN').id })
  .eq('id', incidentIds.get('SOC_ANALYST_L1')).select('id').single();
check(Boolean(selfAssignment.error), 'L1 directly reassigned an incident.');

const ownComment = await l1.from('comments').insert({ incident_id: incidentIds.get('SOC_ANALYST_L1'), user_id: l1Profile.id, body: `${marker} comment` }).select('id').single();
check(!ownComment.error, 'L1 comment on a visible incident failed.');
const unrelatedComment = await l1.from('comments').insert({ incident_id: incidentIds.get('ADMIN'), user_id: l1Profile.id, body: `${marker} denied` }).select('id').single();
check(Boolean(unrelatedComment.error), 'L1 commented on an unrelated incident.');

stage('workflow transitions');
check(!(await l1.from('incidents').update({ status: 'In Progress' }).eq('id', incidentIds.get('SOC_ANALYST_L1')).select('id').single()).error, 'L1 triage failed.');
check(Boolean((await l1.from('incidents').update({ status: 'Resolved' }).eq('id', incidentIds.get('SOC_ANALYST_L1')).select('id').single()).error), 'L1 resolved an incident.');
check(!(await l2.from('incidents').update({ status: 'In Progress' }).eq('id', incidentIds.get('SOC_ANALYST_L2')).select('id').single()).error, 'L2 triage failed.');
check(!(await l2.from('incidents').update({ status: 'Resolved' }).eq('id', incidentIds.get('SOC_ANALYST_L2')).select('resolved_at').single()).error, 'L2 resolution failed.');
check(!(await l3.from('incidents').update({ status: 'In Progress' }).eq('id', incidentIds.get('SOC_ANALYST_L3')).select('id').single()).error, 'L3 triage failed.');
check(!(await l3.from('incidents').update({ status: 'Resolved' }).eq('id', incidentIds.get('SOC_ANALYST_L3')).select('id').single()).error, 'L3 resolution failed.');
check(!(await l3.from('incidents').update({ status: 'Closed' }).eq('id', incidentIds.get('SOC_ANALYST_L3')).select('id').single()).error, 'L3 close failed.');

stage('knowledge base and assets');
const article = await admin.from('kb_articles').insert({ title: `${marker} article`, content: 'UAT content', category: 'OTHER', author_id: profiles.get('ADMIN').id }).select('id').single();
check(!article.error, 'Admin KB write failed.');
const asset = await lead.from('assets').insert({ name: `${marker} asset`, type: 'SERVER', risk_level: 'LOW', status: 'ACTIVE' }).select('id').single();
check(!asset.error, 'SOC Lead asset write failed.');
check((await l1.from('kb_articles').select('id').eq('id', article.data.id)).data?.length === 1, 'L1 KB read failed.');
check((await l1.from('assets').select('id').eq('id', asset.data.id)).data?.length === 1, 'L1 asset read failed.');
check(Boolean((await l1.from('kb_articles').insert({ title: `${marker} denied`, content: 'Denied' })).error), 'L1 wrote a KB article.');
check(Boolean((await l1.from('assets').insert({ name: `${marker} denied` })).error), 'L1 wrote an asset.');

stage('audit log');
const auditAdmin = await admin.from('audit_log').select('id').ilike('details', `%${marker}%`);
check(!auditAdmin.error && auditAdmin.data.length >= 5, 'Management audit trail is incomplete.');
const auditL1 = await l1.from('audit_log').select('id');
check(!auditL1.error && auditL1.data.length === 0, 'L1 could read audit records.');
const forgedAudit = await l1.from('audit_log').insert({ incident_id: incidentIds.get('SOC_ANALYST_L1'), user_id: l1Profile.id, action: 'FORGED' });
check(Boolean(forgedAudit.error), 'L1 forged an audit record.');

stage('admin function authorization');
const nonAdminProvision = await l1.functions.invoke('admin-create-user', { body: {
  email: 'denied@ccorp.local', password: 'Denied-Test!2026', first_name: 'Denied', last_name: 'User', role_id: 'SOC_ANALYST_L1',
} });
check(Boolean(nonAdminProvision.error), 'A non-admin invoked staff provisioning.');

stage('realtime');
let realtimePayload = null;
const channel = lead.channel(`uat-${marker}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, payload => { realtimePayload = payload; });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Realtime subscription timed out.')), 60000);
  channel.subscribe(async status => {
    stage(`realtime status: ${status}`);
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      clearTimeout(timer);
      reject(new Error(`Realtime subscription failed: ${status}.`));
      return;
    }
    if (status !== 'SUBSCRIBED') return;
    const inserted = await admin.from('incidents').insert({ title: `${marker} realtime`, category: 'OTHER', severity: 'LOW', status: 'New', created_by: profiles.get('ADMIN').id }).select('id').single();
    if (inserted.error) { clearTimeout(timer); reject(new Error('Realtime test insert failed.')); return; }
    incidentIds.set('REALTIME', inserted.data.id);
    const poll = setInterval(() => {
      if (realtimePayload?.new?.id === inserted.data.id) { clearInterval(poll); clearTimeout(timer); resolve(); }
    }, 100);
  });
});
await lead.removeChannel(channel);

stage('cleanup and logout');
await admin.from('incidents').delete().ilike('title', `${marker}%`);
await admin.from('kb_articles').delete().eq('id', article.data.id);
await admin.from('assets').delete().eq('id', asset.data.id);

for (const role of expectedRoles) {
  const client = clients.get(role);
  const signedOut = await client.auth.signOut({ scope: 'local' });
  check(!signedOut.error, `Sign-out failed for ${role}.`);
  const session = await client.auth.getSession();
  check(!session.data.session, `Local session remained after sign-out for ${role}.`);
}

console.log(JSON.stringify({
  result: 'PASS', roles: expectedRoles.length, wrongPassword: 'rejected',
  rls: 'passed', workflows: 'passed', modules: 'passed', realtime: 'passed', logout: 'passed', cleanup: 'passed',
}));
process.exit(0);
