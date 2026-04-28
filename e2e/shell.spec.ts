import { test, expect } from './fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test('sidebar — entrée parente reste highlightée sur les sous-pages', async ({ page, loginAs }) => {
  await loginAs('claire.mercier@demo.local', 'demo1234');

  // Sur /app/zones, l'entrée Zones doit être active
  await page.goto('/app/zones');
  const zonesLink = page.getByRole('link', { name: /Zones/i }).first();
  await expect(zonesLink).toHaveClass(/bg-primary\/10/);

  // Cliquer sur la première zone (titre est un lien vers /app/zones/:id)
  const firstZone = page.locator('a[href^="/app/zones/"]').first();
  await firstZone.click();
  await expect(page).toHaveURL(/\/app\/zones\/[^/]+$/);

  // L'entrée Zones de la sidebar doit rester active sur la sous-page
  await expect(zonesLink).toHaveClass(/bg-primary\/10/);
});

test('thème — pas de flash au reload (bootstrap script applique theme avant React)', async ({ page, loginAs }) => {
  await loginAs('claire.mercier@demo.local', 'demo1234');

  // Reload : la classe theme-* est posée sur <html> par le bootstrap, AVANT que React monte
  await page.reload();
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  expect(htmlClass).toMatch(/theme-/);
});
