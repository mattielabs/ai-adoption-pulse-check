import { defineConfig, devices } from '@playwright/test';

const PORT = 8788;

/**
 * Phase 0 keeps the E2E surface intentionally tiny: it proves the Worker,
 * the built SPA assets, and the API routes integrate. Product screens do not
 * exist yet, so there is nothing else worth asserting.
 *
 * The suite runs against `wrangler dev` serving the real built client from
 * `dist/client`, which is the same arrangement used in production.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Build the real client, migrate and seed the local D1 (idempotent,
    // dev-only data), then serve everything through the real Worker.
    command: `npm run build:client && npm run db:migrate:local && npm run db:seed:local && npx wrangler dev --port ${PORT} --local`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
