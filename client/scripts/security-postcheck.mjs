import { createClient } from '@supabase/supabase-js';

const url = process.env.SIRTS_SUPABASE_URL;
const key = process.env.SIRTS_SUPABASE_KEY;
const password = process.env.SIRTS_UAT_PASSWORD;

const required = [
  'SIRTS_ADMIN_EMAIL','SIRTS_LEAD_EMAIL','SIRTS_L1_EMAIL',
  'SIRTS_L2_EMAIL','SIRTS_L3_EMAIL'
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} missing`);
}
if (!url || !key || !password) throw new Error('SIRTS UAT connection variables missing');

const fail = (message, detail) => {
  console.error('FAIL:', message, detail ?? '');
  throw new Error(message);
};
const pass = message => console.log('PASS:', message);

async function login(email, expectedRole) {
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const auth = await client.auth.signInWithPassword({email,password});
  if (auth.error || !auth.data.session) fail(`login ${expectedRole}`,auth.error?.message);
  const profile = await client.from('users').select('id,role_id').eq('id',auth.data.user.id).single();
  if (profile.error || profile.data.role_id !== expectedRole) fail(`profile ${expectedRole}`,profile.error?.message ?? profile.data);
  return {client,id:auth.data.user.id};
}

const admin = await login(process.env.SIRTS_ADMIN_EMAIL,'ADMIN');
const lead = await login(process.env.SIRTS_LEAD_EMAIL,'SOC_LEAD');
const l1 = await login(process.env.SIRTS_L1_EMAIL,'SOC_ANALYST_L1');
const l2 = await login(process.env.SIRTS_L2_EMAIL,'SOC_ANALYST_L2');
const l3 = await login(process.env.SIRTS_L3_EMAIL,'SOC_ANALYST_L3');

const incidentA = await admin.client.from('incidents').select('*').eq('title','Suspicious PowerShell execution').single();
if (incidentA.error) fail('load incident A',incidentA.error.message);
const incidentB = await admin.client.from('incidents').select('*').eq('title','Phishing credential capture').single();
if (incidentB.error) fail('load incident B',incidentB.error.message);

const l1Severity = await l1.client.from('incidents').update({severity:'CRITICAL'}).eq('id',incidentA.data.id).select();
if (!l1Severity.error) fail('L1 severity change must be blocked',l1Severity.data);
pass('L1 severity change is blocked');

const l1Core = await l1.client.from('incidents').update({title:'Tampered incident title'}).eq('id',incidentA.data.id).select();
if (!l1Core.error) fail('L1 core-field edit must be blocked',l1Core.data);
pass('L1 incident intake fields are immutable');

const spoofComment = await l1.client.from('comments').insert({
  incident_id:incidentA.data.id,
  user_id:l2.id,
  body:'spoofed attribution',
}).select();
if (!spoofComment.error) fail('comment attribution spoof must be blocked',spoofComment.data);
pass('comment attribution spoof is blocked');

const l2Close = await l2.client.from('incidents').update({status:'Closed'}).eq('id',incidentB.data.id).select();
if (!l2Close.error) fail('L2 close must be blocked',l2Close.data);
pass('L2 cannot close incidents');

const l3Severity = await l3.client.from('incidents').update({severity:'CRITICAL'}).eq('id',incidentA.data.id).select().single();
if (l3Severity.error || l3Severity.data.severity !== 'CRITICAL') fail('L3 severity update',l3Severity.error?.message ?? l3Severity.data);
pass('L3 can adjust incident severity');

const l3Close = await l3.client.from('incidents').update({status:'Closed'}).eq('id',incidentA.data.id).select();
if (!l3Close.error) fail('L3 close must be blocked',l3Close.data);
pass('L3 cannot close incidents');

const l3AssignLead = await l3.client.from('incidents').update({assigned_to:lead.id}).eq('id',incidentA.data.id).select();
if (!l3AssignLead.error) fail('L3 assignment to Lead must be blocked',l3AssignLead.data);
pass('L3 cannot assign incidents to SOC Lead');

const forgedAudit = await l1.client.from('audit_log').insert({
  incident_id:incidentA.data.id,
  user_id:l1.id,
  action:'FORGED',
  details:'client forged audit',
});
if (!forgedAudit.error) fail('audit forgery must be blocked');
pass('authenticated clients cannot forge audit rows');

const forgedUpdate = await l2.client.from('incident_updates').insert({
  incident_id:incidentA.data.id,
  changed_by:l2.id,
  field_changed:'status',
  old_value:'Assigned',
  new_value:'Closed',
});
if (!forgedUpdate.error) fail('incident history forgery must be blocked');
pass('authenticated clients cannot forge incident history');

const tempIncident = await admin.client.from('incidents').insert({
  title:'Temporary deletion control',
  description:'Temporary UAT record used to confirm administrator deletion control.',
  category:'OTHER',
  severity:'LOW',
  status:'New',
  created_by:admin.id,
}).select().single();
if (tempIncident.error) fail('temporary admin incident',tempIncident.error.message);

const leadDelete = await lead.client.from('incidents').delete().eq('id',tempIncident.data.id).select();
if (leadDelete.error || leadDelete.data.length !== 0) fail('lead delete must be denied',leadDelete.error?.message ?? leadDelete.data);
pass('SOC Lead cannot delete incidents');

const adminDelete = await admin.client.from('incidents').delete().eq('id',tempIncident.data.id).select();
if (adminDelete.error || adminDelete.data.length !== 1) fail('admin delete control',adminDelete.error?.message ?? adminDelete.data);
pass('Admin can delete incidents');

const leadClose = await lead.client.from('incidents').update({status:'Closed'}).eq('id',incidentB.data.id).select().single();
if (leadClose.error || leadClose.data.status !== 'Closed') fail('lead close',leadClose.error?.message ?? leadClose.data);
pass('SOC Lead can close resolved incidents');

const audit = await lead.client.from('audit_log').select('action,incident_id').order('created_at');
if (audit.error || audit.data.length < 5) fail('audit trail coverage',audit.error?.message ?? audit.data);
if (!audit.data.some(row => row.action === 'COMMENT_ADDED')) fail('comment audit entry missing',audit.data);
if (!audit.data.some(row => row.action === 'SEVERITY_CHANGED')) fail('severity audit entry missing',audit.data);
pass('server-owned audit trail records workflow activity');

console.log('POST_BOOTSTRAP_SECURITY_CHECK=PASS');
