import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const roles = ['ADMIN','SOC_LEAD','SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3'];
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => Response.json(body, { status, headers: cors });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const retired = ['tvjyllnfuptdcbirjvev','oslthmbnukpkywapdkje','pvtissqcpskpxlduxuta','txphvpzcbamricsskvoe','qurgnzdxrkkvapsofzcs'];
    const projectRef = new URL(url).hostname.split('.')[0];
    if (!/^[a-z]{20}$/.test(projectRef) || retired.includes(projectRef)) {
      return reply(503, { error: 'Recovery project configuration is incomplete' });
    }
    const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret) return reply(503, { error: 'Account provisioning is unavailable' });
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, { error: 'Sign in first' });
    const { data: identity, error: authError } = await admin.auth.getUser(token);
    if (authError || !identity.user) return reply(401, { error: 'Invalid session' });
    const { data: actor, error: actorError } = await admin.from('users').select('role_id').eq('id', identity.user.id).single();
    if (actorError || actor?.role_id !== 'ADMIN') return reply(403, { error: 'Administrator role required' });
    const body = await req.json();
    const { email, password, first_name, last_name, role_id } = body;
    if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 12 ||
        typeof first_name !== 'string' || !first_name.trim() || typeof last_name !== 'string' || !last_name.trim() || !roles.includes(role_id)) {
      return reply(400, { error: 'Provide email, first and last names, a valid role and a password of at least 12 characters.' });
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(), password, email_confirm: true,
      user_metadata: { first_name: first_name.trim(), last_name: last_name.trim() },
      app_metadata: { sirts_staff: true, sirts_role: role_id },
    });
    if (error) return reply(400, { error: error.message });
    const profile = await admin.from('users').update({
      first_name: first_name.trim(), last_name: last_name.trim(), role_id,
    }).eq('id', data.user.id).select('id').single();
    if (profile.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      return reply(500, { error: 'The staff profile could not be activated.' });
    }
    const audit = await admin.from('audit_log').insert({
      user_id: identity.user.id,
      action: 'USER_PROVISIONED',
      details: JSON.stringify({
        actor_id: identity.user.id,
        actor_role: actor.role_id,
        subject_user_id: data.user.id,
        subject_email: data.user.email,
        assigned_role: role_id,
      }),
    });
    if (audit.error) {
      await admin.from('users').update({ role_id: null }).eq('id', data.user.id);
      await admin.auth.admin.deleteUser(data.user.id);
      return reply(500, { error: 'The staff account could not be recorded in the audit trail.' });
    }
    return reply(201, { id: data.user.id });
  } catch {
    return reply(400, { error: 'Could not create the account. Check the request and retry.' });
  }
});
