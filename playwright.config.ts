import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT } from './e2e/e2eConfig.js';

/**
 * The suite runs against `wrangler dev` serving the real built client from
 * `dist/client` - the same arrangement used in production.
 *
 * `scripts/e2e-server.ts` starts that Worker with a throwaway admin passcode
 * hash, a per-run session secret, and its OWN D1 database in
 * `.wrangler/e2e-state`, recreated empty every run. That matters for two
 * reasons: the admin first-run flow needs a deployment with no organization
 * configured, and a developer's local data in `.wrangler/state` must not be
 * destroyed by running the tests.
 *
 * The `setup` project performs first-run setup and then provisions the Pulses
 * the employee flows use, through the real admin API. Everything downstream
 * therefore runs against Pulses an administrator actually created.
 *
 * `reuseExistingServer` is off precisely because of that empty-database
 * precondition: reusing a server from a previous run would leave an
 * organization already configured and quietly weaken Flow 1.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /admin\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      // Headless Chromium withholds clipboard access unless it is granted,
      // which the Copy link flow needs.
      use: { ...devices['Desktop Chrome'], permissions: ['clipboard-write'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `npm run build:client && npx tsx scripts/e2e-server.ts`,
    url: `http://127.0.0.1:${E2E_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
