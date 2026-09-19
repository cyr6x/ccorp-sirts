import { createClient } from '@supabase/supabase-js';

const url = 'https://pvtissqcpskpxlduxuta.supabase.co';
const key = 'sb_publishable_t1n4jLjtt_eSWDtQj7vCaw_Q2wY6DzY';
const password = 'SIRTS-Test!2026';

const staff = [
  { email:'sarah@ccorp.local', name:'Sarah Namusoke' },
  { email:'cyril@ccorp.local', name:'Cyril Ssentongo' },
  { email:'allan@ccorp.local', name:'Allan Kato' },
  { email:'tony@ccorp.local', name:'Tony Okello' },
  { email:'david@ccorp.local', name:'David Mugisha' },
  { email:'ellen@ccorp.local', name:'Ellen Atim' },
  { email:'lisa@ccorp.local', name:'Lisa Achieng' },
  { email:'mike@ccorp.local', name:'Michael Ochieng' },
];

const client = createClient(url, key, {
  auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});

const results = [];

for (const person of staff) {
  const { data, error } = await client.auth.signUp({
    email:person.email,
    password,
    options:{ data:{ name:person.name } },
  });

  results.push({
    email:person.email,
    signup_error:error?.message ?? null,
    user_created:Boolean(data.user),
    session_created:Boolean(data.session),
    email_confirmed:Boolean(data.user?.email_confirmed_at),
  });
}

console.log(JSON.stringify(results, null, 2));

if (results.some(result => result.signup_error && !/already registered/i.test(result.signup_error))) {
  process.exitCode = 1;
}
