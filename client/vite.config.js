import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateBackendConfig } from './src/lib/backendConfig.js';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  // Local unconfigured builds render the setup screen. Hosted builds must be isolated.
  if (env.VERCEL || env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY) validateBackendConfig(env);
  return {
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-recharts': ['recharts'],
        },
      },
    },
  },
};
});

