import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// Load environment variables so Playwright can reuse the same Supabase config as Next.js.
const envFiles = ['.env.test.local', '.env.local', '.env', '../supabase/.env'];
for (const file of envFiles) {
  const resolvedPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(resolvedPath)) {
    loadEnv({ path: resolvedPath });
  }
}

// Fallbacks so local Supabase defaults also work for the tests.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

if (!process.env.PRIVATE_SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.PRIVATE_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${HOST}:${PORT}`;
const reuseServer = process.env.CI ? false : true;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL,
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: `yarn dev --hostname ${HOST} --port ${PORT}`,
        url: `${baseURL}`,
        reuseExistingServer: reuseServer,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          PORT: String(PORT),
          HOST,
        },
      },
});
