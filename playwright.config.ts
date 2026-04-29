import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:8002',
    locale: 'fr-FR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Démarre automatiquement Django sur la DB E2E (port 8002, indépendant du serveur dev 8001)
  // Prérequis : npm run build (assets statiques) + createdb house_e2e (une seule fois)
  webServer: {
    command: 'DJANGO_SETTINGS_MODULE=config.settings.e2e venv/bin/python manage.py runserver 127.0.0.1:8002 --noreload',
    url: 'http://127.0.0.1:8002',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 30_000,
  },

  projects: [
    { name: 'setup', testMatch: '**/global.setup.ts' },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
