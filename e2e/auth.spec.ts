import { test, expect } from './fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test('login avec des identifiants valides', async ({ page, loginAs }) => {
  await loginAs('claire.mercier@demo.local', 'demo1234');
});

test('login avec un mauvais mot de passe', async ({ page }) => {
  await page.goto('/login');

  await page.getByPlaceholder('Email').fill('claire.mercier@demo.local');
  await page.getByPlaceholder('Mot de passe').fill('wrongpassword');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled({ timeout: 10000 });
  await expect(page).toHaveURL(/\/login/);
});
