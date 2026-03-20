import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/user.json');

const PYTHON = path.resolve(__dirname, '../venv/bin/python');
const MANAGE = path.resolve(__dirname, '../manage.py');
const ROOT = path.resolve(__dirname, '..');
const E2E_ENV = { ...process.env, DJANGO_SETTINGS_MODULE: 'config.settings.e2e' };

setup('seed database', async () => {
  execSync(`${PYTHON} ${MANAGE} migrate`, {
    stdio: 'inherit',
    cwd: ROOT,
    env: E2E_ENV,
  });
  execSync(`${PYTHON} ${MANAGE} seed_demo_data --flush`, {
    stdio: 'inherit',
    cwd: ROOT,
    env: E2E_ENV,
  });
});

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL ?? 'claire.mercier@demo.local');
  await page.getByPlaceholder('Mot de passe').fill(process.env.E2E_PASSWORD ?? 'demo1234');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/app\/dashboard/);

  await page.context().storageState({ path: authFile });
});
