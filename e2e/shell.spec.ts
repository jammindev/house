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

/**
 * Sur écran large, la nav commence là où commence la page (#589).
 *
 * L'en-tête de la sidebar ne porte plus rien au-dessus de `lg` — le nom du
 * foyer a déménagé dans le `TopBar` (#577) et la croix de fermeture est
 * `lg:hidden` — mais son `h-12` réservait toujours ses 48 px : le premier item
 * tombait 40 px sous le titre de la page. Une bande vide ne se voit dans aucun
 * diff et dans aucun test jsdom : elle ne s'atteste qu'en mesurant deux boîtes
 * dans un vrai moteur.
 */
test('sidebar — le premier item s\'aligne sur le contenu de la page', async ({ page, loginAs }) => {
  await loginAs('claire.mercier@demo.local', 'demo1234');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app/zones');

  const firstNavItem = page.locator('aside nav a').first();
  const heading = page.getByRole('heading', { level: 1 }).first();
  await expect(firstNavItem).toBeVisible();
  await expect(heading).toBeVisible();

  const nav = await firstNavItem.boundingBox();
  const title = await heading.boundingBox();
  expect(nav).not.toBeNull();
  expect(title).not.toBeNull();
  expect(Math.abs(nav!.y - title!.y)).toBeLessThanOrEqual(4);
});

test('sidebar — sous `lg`, l\'en-tête garde la croix de fermeture', async ({ page, loginAs }) => {
  await loginAs('claire.mercier@demo.local', 'demo1234');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/app/zones');

  await page.getByRole('button', { name: /Ouvrir le menu|menu/i }).first().click();
  const aside = page.locator('aside');
  await expect(aside.getByTestId('topbar-household')).toBeVisible();
  await expect(aside.locator('button').first()).toBeVisible();
});

test('thème — pas de flash au reload (bootstrap script applique theme avant React)', async ({ page, loginAs }) => {
  await loginAs('claire.mercier@demo.local', 'demo1234');

  // Reload : la classe theme-* est posée sur <html> par le bootstrap, AVANT que React monte
  await page.reload();
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  expect(htmlClass).toMatch(/theme-/);
});
