import { type PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npm run dev',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
  },
};

export default config; 