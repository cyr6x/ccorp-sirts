import { createClient } from '@supabase/supabase-js';

/**
 * Browser-safe Supabase defaults for the SIRTS project.
 *
 * Supabase publishable keys are designed to be embedded in client applications.
 * Vercel/local environment variables still take precedence so the project can
 * be pointed at another Supabase environment without changing source code.
 */
const DEFAULT_SUPABASE_URL = 'https://tvjyllnfuptdcbirjvev.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_S25ZvJRl2EBDSm_xIgB-bQ_PNilZ88P';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

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
