import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// Never fall back to the shared production database from this development branch.
// A harmless placeholder client keeps imports stable until the isolated branch
// credentials are wired into the preview environment.
export const supabase = createClient(
  supabaseUrl || 'https://example.invalid',
  supabasePublishableKey || 'sb_publishable_dev_not_configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
