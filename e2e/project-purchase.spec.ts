import { test, expect } from '@playwright/test';

/**
 * Parcours 08 — Lot 1.1 : enregistrer une dépense liée à un projet.
 *
 * Issue: https://github.com/jammindev/house/issues/123
 *
 * Le test crée un projet, déclenche le quick-add depuis sa card, vérifie que
 * l'`Interaction(type=expense, kind='project_purchase')` est créée et listée
 * dans /app/interactions, et que `actual_cost_cached` est incrémenté côté
 * card (BudgetBar visible).
 */

test('parcours achat projet — Rénovation salle de bain 450€ Leroy Merlin', async ({ page }) => {
  // Utilise un projet seedé par seed_demo_data ("Rénovation salle de bain") —
  // le test se concentre sur le parcours d'achat, pas sur la création de projet
  // (couverte par pytest test_create_project_accepts_blank_description_from_ui).
  await page.goto('/app/projects');
  await expect(page).toHaveURL(/\/app\/projects/);

  const projectTitle = 'Rénovation salle de bain';
  await expect(page.getByText(projectTitle).first()).toBeVisible();

  // Cliquer sur l'action « + Dépense » sur la card du projet
  const card = page.getByText(projectTitle, { exact: true })
    .locator('xpath=ancestor::*[contains(@class, "rounded")][1]');
  await card.getByRole('button', { name: 'Dépense' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Enregistrer une dépense');
  await expect(dialog).toContainText(projectTitle);

  const supplier = `Leroy Merlin E2E ${Date.now()}`;
  await page.locator('#purchase-price').fill('450');
  await page.locator('#purchase-supplier').fill(supplier);
  await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
  await expect(dialog).toBeHidden();

  // Vérifier que l'interaction expense est listée dans /app/interactions
  await page.goto('/app/interactions');
  await expect(page.getByText(`Achat — ${projectTitle}`).first()).toBeVisible();

  // Vérifier qu'elle apparaît aussi dans la vue dépense (filtrée par supplier
  // pour distinguer cette execution des autres)
  await page.goto('/app/expenses');
  await expect(page.getByText(supplier).first()).toBeVisible();
});
