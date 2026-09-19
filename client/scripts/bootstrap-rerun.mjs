import { appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const URL = 'https://oslthmbnukpkywapdkje.supabase.co';
const KEY = 'sb_publishable_YRpCIiZ20GW5e5PMcT6SZg_D6GZNoJU';
const password = `SIRTS-UAT-${randomBytes(8).toString('hex')}!Aa9`;
const staff = [
  ['uat.admin@ccorp.local','UAT Admin','ADMIN','SIRTS_UAT_ADMIN_EMAIL'],
  ['uat.lead@ccorp.local','UAT Lead','SOC_LEAD','SIRTS_UAT_LEAD_EMAIL'],
  ['uat.l1@ccorp.local','UAT Analyst','SOC_ANALYST_L1','SIRTS_UAT_L1_EMAIL'],
  ['uat.l3@ccorp.local','UAT Hunter','SOC_ANALYST_L3','SIRTS_UAT_L3_EMAIL'],
];

const headers = token => ({
  apikey: KEY,
  'Content-Type':'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function req(path, options={}) {
  const response = await fetch(`${URL}${path}`, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

for (const [email,name,role,envName] of staff) {
  await req('/auth/v1/signup', {
    method:'POST',
    headers:headers(),
    body:JSON.stringify({ email, password, data:{ name } }),
  });
  const session = await req('/auth/v1/token?grant_type=password', {
    method:'POST',
    headers:headers(),
    body:JSON.stringify({ email, password }),
  });
  await req('/rest/v1/rpc/dev_assign_my_role', {
    method:'POST',
    headers:headers(session.access_token),
    body:'{}',
  });
  const profile = await req(`/rest/v1/users?id=eq.${session.user.id}&select=role_id`, {
    headers:headers(session.access_token),
  });
  if (profile?.[0]?.role_id !== role) throw new Error(`role mismatch for ${email}`);
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${envName}=${email}\n`);
}

if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `SIRTS_UAT_PASSWORD=${password}\n`);
console.log('Temporary browser-UAT accounts created and role-verified.');
