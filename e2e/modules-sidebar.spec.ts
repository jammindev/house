import { test, expect } from './fixtures';

// Parcours 15 — modules activables par foyer + épinglés perso.
// Storage state par défaut = Claire (owner du foyer démo).

test('épingler un module le remonte en tête de sidebar (persistant), désépingler le rend à son groupe', async ({ page }) => {
  await page.goto('/app/dashboard');
  const sidebar = page.locator('aside');

  // Pas de section Épinglés au départ
  await expect(sidebar.getByText('Épinglés')).toHaveCount(0);

  // Épingler « Tâches » via le bouton au survol
  const tasksLink = sidebar.getByRole('link', { name: 'Tâches' });
  await tasksLink.hover();
  await tasksLink.getByRole('button', { name: 'Épingler', exact: true }).click();

  // La section apparaît, l'item sort de son groupe (un seul lien Tâches au total)
  await expect(sidebar.getByText('Épinglés')).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Tâches' })).toHaveCount(1);

  // Persistance : le pin survit à un reload (stocké sur le user, pas en local)
  await page.reload();
  await expect(sidebar.getByText('Épinglés')).toBeVisible();

  // Désépingler → la section disparaît, l'item revient dans son groupe
  const pinnedTasks = sidebar.getByRole('link', { name: 'Tâches' });
  await pinnedTasks.hover();
  await pinnedTasks.getByRole('button', { name: 'Désépingler', exact: true }).click();
  await expect(sidebar.getByText('Épinglés')).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Tâches' })).toHaveCount(1);
});

test('désactiver un module (owner) le retire de la sidebar et garde sa route, réactiver le restaure', async ({ page }) => {
  const sidebar = page.locator('aside');

  // État initial : Assurances visible dans la sidebar
  await page.goto('/app/dashboard');
  await expect(sidebar.getByRole('link', { name: 'Assurances' })).toBeVisible();

  // Réglages → section Modules (owner only) → décocher Assurances
  await page.goto('/app/settings');
  const modulesCheckbox = page.locator('#module-insurance');
  await expect(modulesCheckbox).toBeChecked();
  await modulesCheckbox.click();
  await expect(page.getByText('Modules mis à jour').first()).toBeVisible();

  // La sidebar ne montre plus Assurances
  await expect(sidebar.getByRole('link', { name: 'Assurances' })).toHaveCount(0);

  // L'URL directe redirige vers le dashboard
  await page.goto('/app/insurance');
  await expect(page).toHaveURL(/\/app\/dashboard/);

  // Réactivation → tout revient (aucune donnée perdue)
  await page.goto('/app/settings');
  await expect(modulesCheckbox).not.toBeChecked();
  await modulesCheckbox.click();
  await expect(page.getByText('Modules mis à jour').first()).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Assurances' })).toBeVisible();
});

test.describe('membre non-owner', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('la section Modules des réglages est réservée à l’owner', async ({ page, loginAs }) => {
    await loginAs('antoine.mercier@demo.local', 'demo1234');
    await page.goto('/app/settings');
    // La page est bien chargée (une autre section visible)…
    await expect(page.getByText('Profil').first()).toBeVisible();
    // …mais Antoine est member : pas de section Modules
    await expect(page.getByText('Choisissez les modules actifs pour ce foyer.')).toHaveCount(0);
  });
});
