import { createClient } from '@supabase/supabase-js';
import { validateBackendConfig } from './backendConfig.js';

let config;
let configurationError = '';
try { config = validateBackendConfig(import.meta.env); }
catch (error) { configurationError = error.message; }
export { configurationError };
// Never instantiate a client against an old or placeholder database.
export const supabase = config ? createClient(config.url, config.key, {
  auth: {
    storageKey: `sirts-rebuild-${config.projectRef}`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
}) : null;
