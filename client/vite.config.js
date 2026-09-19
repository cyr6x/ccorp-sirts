import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateBackendConfig } from './src/lib/backendConfig.js';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  // An entirely unconfigured recovery preview renders the setup-pending screen.
  // Any partial or incorrect backend configuration still fails closed at build time.
  const hasBackendConfig = [
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    env.VITE_SUPABASE_PROJECT_REF,
  ].some(Boolean);
  if (hasBackendConfig) validateBackendConfig(env);
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
