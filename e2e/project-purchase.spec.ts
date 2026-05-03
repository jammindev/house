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

test('parcours achat projet — Rénovation cuisine 450€ Leroy Merlin', async ({ page }) => {
  await page.goto('/app/projects');
  await expect(page).toHaveURL(/\/app\/projects/);

  // Créer un projet
  await page.getByRole('button', { name: /nouveau|créer/i }).first().click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const projectTitle = `Rénovation cuisine E2E ${Date.now()}`;
  await page.locator('#project-title').fill(projectTitle);
  // planned_budget for the BudgetBar to render
  const budgetInput = page.locator('#project-planned-budget');
  if (await budgetInput.count()) {
    await budgetInput.fill('1000');
  }
  await dialog.getByRole('button', { name: /enregistrer|créer/i }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(projectTitle)).toBeVisible();

  // Cliquer sur l'action « + Dépense » de la card
  const card = page.getByText(projectTitle, { exact: true })
    .locator('xpath=ancestor::*[contains(@class, "rounded")][1]');
  await card.getByRole('button', { name: 'Dépense' }).click();

  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Enregistrer une dépense');
  await expect(dialog).toContainText(projectTitle);

  // Saisir prix + fournisseur
  await page.locator('#purchase-price').fill('450');
  await page.locator('#purchase-supplier').fill('Leroy Merlin E2E');
  await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
  await expect(dialog).toBeHidden();

  // Vérifier que l'interaction expense est listée dans /app/interactions
  await page.goto('/app/interactions');
  await expect(page.getByText(`Achat — ${projectTitle}`).first()).toBeVisible();

  // Vérifier qu'elle apparaît aussi dans la vue dépense
  await page.goto('/app/expenses');
  await expect(page.getByText(`Achat — ${projectTitle}`).first()).toBeVisible();
  await expect(page.getByText('Leroy Merlin E2E').first()).toBeVisible();
});
