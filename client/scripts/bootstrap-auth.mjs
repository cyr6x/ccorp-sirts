import { createClient } from '@supabase/supabase-js';

const url = 'https://oslthmbnukpkywapdkje.supabase.co';
const key = 'sb_publishable_YRpCIiZ20GW5e5PMcT6SZg_D6GZNoJU';
const password = 'SIRTS-Test!2026';

const staff = [
  { email:'sarah@ccorp.example.com', name:'Sarah Namusoke' },
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

if (results.some(result => result.signup_error)) {
  process.exitCode = 1;
}
