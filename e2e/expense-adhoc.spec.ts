import { test, expect } from '@playwright/test';

/**
 * Parcours 08 — Lot 1.2 : enregistrer une dépense ad-hoc.
 *
 * Issue: https://github.com/jammindev/house/issues/124
 *
 * La dépense ad-hoc n'a pas de source : c'est l'utilisateur qui saisit
 * le sujet libre. metadata.kind = 'manual', source_content_type = NULL.
 */

test('parcours dépense ad-hoc — Restaurant Le Bistrot 32€', async ({ page }) => {
  await page.goto('/app/expenses');
  await expect(page).toHaveURL(/\/app\/expenses/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dépenses' })).toBeVisible();

  // Cliquer sur le bouton « + Dépense » du PageHeader
  await page.getByRole('button', { name: 'Dépense' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Enregistrer une dépense ad-hoc');

  const subject = `Restaurant E2E ${Date.now()}`;
  await page.locator('#adhoc-subject').fill(subject);
  await page.locator('#purchase-price').fill('32');
  await page.locator('#purchase-supplier').fill('Le Bistrot E2E');
  await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
  await expect(dialog).toBeHidden();

  // Vérifier que la dépense apparaît dans la vue dépense (le subject est
  // saisi tel-quel — pas de template gettext)
  await expect(page.getByText(subject).first()).toBeVisible();

  // Vérifier qu'elle apparaît aussi dans /app/interactions
  await page.goto('/app/interactions');
  await expect(page.getByText(subject).first()).toBeVisible();
});

test('parcours dépense ad-hoc — sujet vide refusé', async ({ page }) => {
  await page.goto('/app/expenses');
  await page.getByRole('button', { name: 'Dépense' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Tenter de soumettre sans sujet
  await page.locator('#purchase-price').fill('10');
  await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();

  // Le dialog reste ouvert (validation côté front)
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Un sujet est requis');
});
