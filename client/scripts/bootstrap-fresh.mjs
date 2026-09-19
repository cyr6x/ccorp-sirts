import { appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = 'https://pvtissqcpskpxlduxuta.supabase.co';
const key = 'sb_publishable_t1n4jLjtt_eSWDtQj7vCaw_Q2wY6DzY';
const password = `SIRTS-${randomBytes(8).toString('hex')}!Aa9`;

const staff = [
  { email:'sarah@ccorp.example.com', name:'Sarah Namusoke', role:'ADMIN' },
  { email:'cyril@ccorp.example.com', name:'Cyril Okello', role:'SOC_LEAD' },
  { email:'allan@ccorp.example.com', name:'Allan Kato', role:'SOC_ANALYST_L1' },
  { email:'tony@ccorp.example.com', name:'Tony Okello', role:'SOC_ANALYST_L2' },
  { email:'david@ccorp.example.com', name:'David Mugisha', role:'SOC_ANALYST_L3' },
  { email:'ellen@ccorp.example.com', name:'Ellen Atim', role:'SOC_ANALYST_L3' },
  { email:'lisa@ccorp.example.com', name:'Lisa Achieng', role:'SOC_ANALYST_L3' },
  { email:'mike@ccorp.example.com', name:'Michael Ochieng', role:'SOC_ANALYST_L3' },
];

const sessions = new Map();

const fail = (message, detail) => {
  console.error('FAIL:', message, detail ?? '');
  throw new Error(message);
};
const pass = message => console.log('PASS:', message);

for (const person of staff) {
  const client = createClient(url, key, {
    auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  });

  const signup = await client.auth.signUp({
    email:person.email,
    password,
    options:{ data:{ name:person.name } },
  });
  if (signup.error) fail(`signup ${person.email}`, signup.error.message);
  pass(`signup ${person.email}`);

  const login = await client.auth.signInWithPassword({ email:person.email, password });
  if (login.error || !login.data.session) fail(`password login ${person.email}`, login.error?.message);
  pass(`password login ${person.email}`);

  const role = await client.rpc('dev_assign_my_role');
  if (role.error || role.data !== person.role) fail(`role assignment ${person.email}`, role.error?.message ?? role.data);
  pass(`role assignment ${person.email}`);

  const profile = await client.from('users').select('email,name,role_id').eq('id',login.data.user.id).single();
  if (profile.error || profile.data.role_id !== person.role) fail(`profile ${person.email}`, profile.error?.message ?? profile.data);
  pass(`profile resolves ${person.role} for ${person.email}`);

  sessions.set(person.email,{ client,id:login.data.user.id,role:person.role });
}

const admin = sessions.get('sarah@ccorp.example.com');
const lead = sessions.get('cyril@ccorp.example.com');
const l1 = sessions.get('allan@ccorp.example.com');
const l2 = sessions.get('tony@ccorp.example.com');
const l3 = sessions.get('david@ccorp.example.com');

const anon = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const anonRead = await anon.from('incidents').select('id');
if (!anonRead.error) fail('anonymous incident access should be denied');
pass('anonymous incident access is denied');

const directory = await admin.client.from('users').select('id,email,name,role_id').order('name');
if (directory.error || directory.data.length !== 8) fail('staff directory should contain eight users',directory.error?.message ?? directory.data);
pass('authenticated staff directory contains eight users');

const incidentA = await admin.client.from('incidents').insert({
  title:'Suspicious PowerShell execution',
  description:'EDR detected encoded PowerShell activity on a managed finance workstation.',
  category:'MALWARE',
  severity:'HIGH',
  status:'New',
  source_ip:'10.20.30.44',
  affected_asset:'FIN-WS-014',
  created_by:admin.id,
  assigned_to:null,
}).select().single();
if (incidentA.error) fail('admin incident creation',incidentA.error.message);
pass('admin can create an incident');

const incidentB = await admin.client.from('incidents').insert({
  title:'Phishing credential capture',
  description:'A user reported a credential-harvesting page delivered through a targeted phishing message.',
  category:'PHISHING',
  severity:'CRITICAL',
  status:'Assigned',
  source_ip:'185.220.101.10',
  affected_asset:'MAIL-GW-01',
  created_by:admin.id,
  assigned_to:l2.id,
}).select().single();
if (incidentB.error) fail('admin incident assignment',incidentB.error.message);
pass('admin can assign an incident to L2');

const comment = await l2.client.from('comments').insert({
  incident_id:incidentB.data.id,
  user_id:l2.id,
  body:'Initial triage completed; malicious domain blocked and affected account isolated.',
});
if (comment.error) fail('L2 comment',comment.error.message);
pass('L2 can add an investigation comment');

const resolve = await l2.client.from('incidents').update({status:'Resolved'}).eq('id',incidentB.data.id).select().single();
if (resolve.error || resolve.data.status !== 'Resolved') fail('L2 resolve',resolve.error?.message ?? resolve.data);
pass('L2 can resolve an assigned incident');

const l1Deny = await l1.client.from('incidents').update({status:'Resolved',assigned_to:l1.id}).eq('id',incidentA.data.id).select();
if (!l1Deny.error) fail('L1 resolve should be denied',l1Deny.data);
pass('L1 cannot resolve incidents');

const l1Claim = await l1.client.from('incidents').update({status:'Assigned',assigned_to:l1.id}).eq('id',incidentA.data.id).select().single();
if (l1Claim.error || l1Claim.data.assigned_to !== l1.id) fail('L1 claim',l1Claim.error?.message ?? l1Claim.data);
pass('L1 can claim an unassigned incident');

const kb = await l3.client.from('kb_articles').insert({
  title:'PowerShell containment quick guide',
  summary:'Initial containment steps for suspicious PowerShell execution.',
  content:'Validate the parent process, isolate the endpoint, preserve telemetry, and escalate if persistence is detected.',
  category:'MALWARE',
  author_id:l3.id,
});
if (kb.error) fail('L3 KB creation',kb.error.message);
pass('L3 can create knowledge-base content');

const asset = await l3.client.from('assets').insert({
  name:'FIN-WS-014',
  type:'WORKSTATION',
  ip_address:'10.20.30.14',
  os:'Windows 11',
  owner:'Finance',
  risk_level:'HIGH',
  status:'ACTIVE',
  notes:'UAT asset',
});
if (asset.error) fail('L3 asset creation',asset.error.message);
pass('L3 can register an asset');

const l1Audit = await l1.client.from('audit_log').select('id,action');
if (l1Audit.error || l1Audit.data.length !== 0) fail('L1 audit isolation',l1Audit.error?.message ?? l1Audit.data);
pass('L1 cannot read audit records');

const leadAudit = await lead.client.from('audit_log').select('id,action');
if (leadAudit.error || leadAudit.data.length < 2) fail('lead audit read',leadAudit.error?.message ?? leadAudit.data);
pass('SOC Lead can read audit records');

const adminRole = await admin.client.from('users').update({role_id:'SOC_ANALYST_L2'}).eq('id',l2.id).select();
if (adminRole.error || adminRole.data.length !== 1) fail('admin role management',adminRole.error?.message ?? adminRole.data);
pass('Admin can manage staff roles');

const leadRole = await lead.client.from('users').update({role_id:'SOC_ANALYST_L2'}).eq('id',l1.id).select();
if (leadRole.error || leadRole.data.length !== 0) fail('lead role denial',leadRole.error?.message ?? leadRole.data);
pass('SOC Lead cannot change staff roles');

if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV,`SIRTS_UAT_PASSWORD=${password}\n`);
console.log(`SIRTS_UAT_PASSWORD=${password}`);
