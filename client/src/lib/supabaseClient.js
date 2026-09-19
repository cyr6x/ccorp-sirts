import { createClient } from '@supabase/supabase-js';

const DEFAULT_DEV_SUPABASE_URL = 'https://oslthmbnukpkywapdkje.supabase.co';
const DEFAULT_DEV_PUBLISHABLE_KEY = 'sb_publishable_YRpCIiZ20GW5e5PMcT6SZg_D6GZNoJU';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  DEFAULT_DEV_SUPABASE_URL;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_DEV_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
