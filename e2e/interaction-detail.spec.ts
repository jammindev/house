import { test, expect } from './fixtures';

// ---------------------------------------------------------------------------
// Page de détail d'une interaction (note)
// ---------------------------------------------------------------------------

test('crée une note puis ouvre sa page de détail', async ({ page }) => {
  const subject = `Note détail E2E ${Date.now()}`;

  // Création d'une note (type par défaut) depuis le formulaire.
  await page.goto('/app/interactions/new');
  await page.getByPlaceholder('Résumé court').fill(subject);
  await page.getByRole('button', { name: 'Ajouter un événement' }).click();

  // Retour à la liste, la note apparaît en tête.
  await expect(page).toHaveURL(/\/app\/interactions$/);

  // Le titre de la carte ouvre la page de détail.
  await page.getByRole('link', { name: subject }).click();

  await expect(page).toHaveURL(/\/app\/interactions\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: subject })).toBeVisible();
  await expect(page.getByText('Note', { exact: true })).toBeVisible();
});

test('la page de détail redirige vers l\'édition', async ({ page }) => {
  const subject = `Note édition E2E ${Date.now()}`;

  await page.goto('/app/interactions/new');
  await page.getByPlaceholder('Résumé court').fill(subject);
  await page.getByRole('button', { name: 'Ajouter un événement' }).click();
  await expect(page).toHaveURL(/\/app\/interactions$/);

  await page.getByRole('link', { name: subject }).click();
  await expect(page.getByRole('heading', { name: subject })).toBeVisible();

  await page.getByRole('button', { name: 'Modifier' }).click();
  await expect(page).toHaveURL(/\/app\/interactions\/[0-9a-f-]+\/edit$/);
});
