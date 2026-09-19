import { appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const SUPABASE_URL = 'https://oslthmbnukpkywapdkje.supabase.co';
const ANON_KEY = 'sb_publishable_YRpCIiZ20GW5e5PMcT6SZg_D6GZNoJU';
const password = `SIRTS-${randomBytes(8).toString('hex')}!Aa9`;
console.log(`SIRTS_UAT_PASSWORD=${password}`);

const staff = [
  { email:'sarah@ccorp.local', name:'Sarah Namusoke', role:'ADMIN' },
  { email:'cyril@ccorp.local', name:'Cyril Okello', role:'SOC_LEAD' },
  { email:'allan@ccorp.local', name:'Allan Kato', role:'SOC_ANALYST_L1' },
  { email:'tony@ccorp.local', name:'Tony Okello', role:'SOC_ANALYST_L2' },
  { email:'david@ccorp.local', name:'David Mugisha', role:'SOC_ANALYST_L3' },
  { email:'ellen@ccorp.local', name:'Ellen Atim', role:'SOC_ANALYST_L3' },
  { email:'lisa@ccorp.local', name:'Lisa Achieng', role:'SOC_ANALYST_L3' },
  { email:'mike@ccorp.local', name:'Michael Ochieng', role:'SOC_ANALYST_L3' },
];

const headers = token => ({
  apikey: ANON_KEY,
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const request = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}${path}`, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok:response.ok, status:response.status, body, headers:response.headers };
};

const must = (condition, message, detail) => {
  if (!condition) {
    console.error('FAIL:', message, detail ?? '');
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log('PASS:', message);
};

const sessions = new Map();

for (const entry of staff) {
  const signup = await request('/auth/v1/signup', {
    method:'POST',
    headers:headers(),
    body:JSON.stringify({
      email:entry.email,
      password,
      data:{ name:entry.name },
    }),
  });
  must(signup.ok, `signup ${entry.email}`, signup.body);

  const login = await request('/auth/v1/token?grant_type=password', {
    method:'POST',
    headers:headers(),
    body:JSON.stringify({ email:entry.email, password }),
  });
  must(login.ok && login.body?.access_token && login.body?.user?.id, `password login ${entry.email}`, login.body);

  const token = login.body.access_token;
  sessions.set(entry.email, { token, id:login.body.user.id, role:entry.role, name:entry.name });

  const assign = await request('/rest/v1/rpc/dev_assign_my_role', {
    method:'POST',
    headers:headers(token),
    body:'{}',
  });
  must(assign.ok, `assign expected role ${entry.email}`, assign.body);

  const profile = await request(`/rest/v1/users?id=eq.${login.body.user.id}&select=email,name,role_id`, {
    headers:headers(token),
  });
  must(profile.ok && profile.body?.[0]?.role_id === entry.role, `profile resolves ${entry.role} for ${entry.email}`, profile.body);
}

const admin = sessions.get('sarah@ccorp.local');
const lead = sessions.get('cyril@ccorp.local');
const l1 = sessions.get('allan@ccorp.local');
const l2 = sessions.get('tony@ccorp.local');
const l3 = sessions.get('david@ccorp.local');

const anonIncidents = await request('/rest/v1/incidents?select=id', { headers:headers() });
must(!anonIncidents.ok, 'anonymous incident access is denied', anonIncidents.body);

const users = await request('/rest/v1/users?select=id,email,name,role_id&order=name.asc', { headers:headers(admin.token) });
must(users.ok && users.body.length === 8, 'authenticated staff directory contains eight users', users.body);

const incidentA = await request('/rest/v1/incidents', {
  method:'POST',
  headers:{ ...headers(admin.token), Prefer:'return=representation' },
  body:JSON.stringify({
    title:'Suspicious PowerShell execution',
    description:'EDR detected encoded PowerShell activity on a managed finance workstation.',
    category:'MALWARE',
    severity:'HIGH',
    status:'New',
    source_ip:'10.20.30.44',
    affected_asset:'FIN-WS-014',
    created_by:admin.id,
    assigned_to:null,
  }),
});
must(incidentA.ok && incidentA.body?.[0]?.id, 'admin can create an incident', incidentA.body);
const incidentAId = incidentA.body[0].id;

const incidentB = await request('/rest/v1/incidents', {
  method:'POST',
  headers:{ ...headers(admin.token), Prefer:'return=representation' },
  body:JSON.stringify({
    title:'Phishing credential capture',
    description:'A user reported a credential-harvesting page delivered through a targeted phishing message.',
    category:'PHISHING',
    severity:'CRITICAL',
    status:'Assigned',
    source_ip:'185.220.101.10',
    affected_asset:'MAIL-GW-01',
    created_by:admin.id,
    assigned_to:l2.id,
  }),
});
must(incidentB.ok && incidentB.body?.[0]?.id, 'admin can assign an incident to L2', incidentB.body);
const incidentBId = incidentB.body[0].id;

const comment = await request('/rest/v1/comments', {
  method:'POST',
  headers:{ ...headers(l2.token), Prefer:'return=representation' },
  body:JSON.stringify({
    incident_id:incidentBId,
    user_id:l2.id,
    body:'Initial triage completed; malicious domain blocked and affected account isolated.',
  }),
});
must(comment.ok, 'L2 can add an investigation comment', comment.body);

const resolveL2 = await request(`/rest/v1/incidents?id=eq.${incidentBId}`, {
  method:'PATCH',
  headers:{ ...headers(l2.token), Prefer:'return=representation' },
  body:JSON.stringify({ status:'Resolved' }),
});
must(resolveL2.ok && resolveL2.body?.[0]?.status === 'Resolved', 'L2 can resolve an assigned incident', resolveL2.body);

const l1Forbidden = await request(`/rest/v1/incidents?id=eq.${incidentAId}`, {
  method:'PATCH',
  headers:{ ...headers(l1.token), Prefer:'return=representation' },
  body:JSON.stringify({ status:'Resolved', assigned_to:l1.id }),
});
must(!l1Forbidden.ok, 'L1 cannot resolve incidents', l1Forbidden.body);

const l1Claim = await request(`/rest/v1/incidents?id=eq.${incidentAId}`, {
  method:'PATCH',
  headers:{ ...headers(l1.token), Prefer:'return=representation' },
  body:JSON.stringify({ status:'Assigned', assigned_to:l1.id }),
});
must(l1Claim.ok && l1Claim.body?.[0]?.assigned_to === l1.id, 'L1 can claim an unassigned incident', l1Claim.body);

const kb = await request('/rest/v1/kb_articles', {
  method:'POST',
  headers:{ ...headers(l3.token), Prefer:'return=representation' },
  body:JSON.stringify({
    title:'PowerShell containment quick guide',
    summary:'Initial containment steps for suspicious PowerShell execution.',
    content:'Validate the parent process, isolate the endpoint, preserve telemetry, and escalate if persistence is detected.',
    category:'MALWARE',
    author_id:l3.id,
  }),
});
must(kb.ok, 'L3 can create knowledge-base content', kb.body);

const asset = await request('/rest/v1/assets', {
  method:'POST',
  headers:{ ...headers(l3.token), Prefer:'return=representation' },
  body:JSON.stringify({
    name:'FIN-WS-014',
    type:'WORKSTATION',
    ip_address:'10.20.30.14',
    os:'Windows 11',
    owner:'Finance',
    risk_level:'HIGH',
    status:'ACTIVE',
    notes:'UAT asset',
  }),
});
must(asset.ok, 'L3 can register an asset', asset.body);

const l1Audit = await request('/rest/v1/audit_log?select=id,action', { headers:headers(l1.token) });
must(l1Audit.ok && Array.isArray(l1Audit.body) && l1Audit.body.length === 0, 'L1 cannot read audit records', l1Audit.body);

const leadAudit = await request('/rest/v1/audit_log?select=id,action&order=created_at.desc', { headers:headers(lead.token) });
must(leadAudit.ok && leadAudit.body.length >= 2, 'SOC Lead can read audit records', leadAudit.body);

const roleTouch = await request(`/rest/v1/users?id=eq.${l2.id}`, {
  method:'PATCH',
  headers:{ ...headers(admin.token), Prefer:'return=representation' },
  body:JSON.stringify({ role_id:'SOC_ANALYST_L2' }),
});
must(roleTouch.ok, 'Admin can manage staff roles', roleTouch.body);

const leadRoleDenied = await request(`/rest/v1/users?id=eq.${l1.id}`, {
  method:'PATCH',
  headers:{ ...headers(lead.token), Prefer:'return=representation' },
  body:JSON.stringify({ role_id:'SOC_ANALYST_L2' }),
});
must(leadRoleDenied.ok && Array.isArray(leadRoleDenied.body) && leadRoleDenied.body.length === 0, 'SOC Lead cannot change staff roles', leadRoleDenied.body);

if (process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, `SIRTS_UAT_PASSWORD=${password}\n`);
}

console.log(`SIRTS_UAT_PASSWORD=${password}`);
console.log(JSON.stringify({
  staff:staff.map(entry => ({ email:entry.email, role:entry.role })),
  incidentAId,
  incidentBId,
}, null, 2));
