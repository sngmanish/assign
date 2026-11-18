import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: the real app against the real API and a throwaway Postgres database.
// Needs the docker-compose Postgres running (`docker compose up -d` from the repo root).
// Ports differ from `npm run dev` (5173 / 3000), so a running dev setup is left alone.
const API_PORT = 3100;
const WEB_PORT = 5174;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // recreates the e2e database, then starts the API (migrations and seed run on start)
      command: 'node e2e/start-api.mjs',
      url: `${API_URL}/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_ORIGIN: WEB_URL },
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      env: { VITE_API_URL: API_URL },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
