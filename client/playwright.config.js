import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',
  workers:1,
  retries:1,
  reporter:[['list']],
  use:{
    baseURL:'http://127.0.0.1:4173',
    viewport:{ width:1440, height:900 },
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
  },
  webServer:{
    command:'npm run dev -- --host 127.0.0.1 --port 4173',
    url:'http://127.0.0.1:4173/login',
    timeout:120000,
    reuseExistingServer:false,
  },
});
