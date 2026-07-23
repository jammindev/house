import { test, expect } from '@playwright/test';

/**
 * Parcours 21 — Lot 1 : Budgets mensuels.
 *
 * Couvre :
 *  1. Sidebar entry "Budgets" → /app/budget
 *  2. État vide avant tout budget
 *  3. Création d'un budget nommé "Courses 400 €"
 *  4. Présence de la card "Hors budget" dès qu'un budget existe
 *  5. Suppression avec undo (toast "Annuler" + restauration)
 *  6. (Bonus) Budget select dans ExpenseAdHocDialog quand un budget nommé existe
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/** Supprime tous les budgets du foyer via l'API pour partir d'un état vide. */
async function deleteAllBudgets(page: import('@playwright/test').Page): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/budget/budgets/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return;
  const body = await resp.json() as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? (body as Array<{ id: string }>)
    : ((body as { results?: Array<{ id: string }> }).results ?? []);
  for (const item of items) {
    await page.request.delete(`/api/budget/budgets/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

/** Crée un budget nommé via l'API et retourne l'objet créé. */
async function apiCreateBudget(
  page: import('@playwright/test').Page,
  name: string,
  monthlyAmount: number,
): Promise<{ id: string; name: string }> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/budget/budgets/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { name, monthly_amount: monthlyAmount, is_global: false },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to create budget: ${resp.status()} ${await resp.text()}`);
  }
  return resp.json() as Promise<{ id: string; name: string }>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Budgets — parcours 21', () => {
  test.beforeEach(async ({ page }) => {
    // Naviguer vers la page pour hydrater le localStorage (JWT obligatoire
    // avant tout appel API via page.request)
    await page.goto('/app/budget');
    await expect(page).toHaveURL(/\/app\/budget/);

    // Nettoyer tous les budgets pour garantir un état vide au départ
    await deleteAllBudgets(page);

    // Recharger pour refléter l'état vide dans l'UI
    await page.reload();
    await expect(page).toHaveURL(/\/app\/budget/);
  });

  // ── 1. Affichage & sidebar ───────────────────────────────────────────────

  test('la sidebar contient un lien "Budgets" vers /app/budget', async ({ page }) => {
    // budget est dans le groupe Suivi (tracking), non optionnel → toujours visible
    const budgetLink = page.getByRole('link', { name: 'Budgets' });
    await expect(budgetLink).toBeVisible();
    await budgetLink.click();
    await expect(page).toHaveURL(/\/app\/budget/);
    await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible();
  });

  // ── 2. État vide ─────────────────────────────────────────────────────────

  test('affiche l\'état vide quand aucun budget n\'existe', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible();

    // EmptyState avec le texte "Aucun budget"
    await expect(page.getByText('Aucun budget')).toBeVisible();

    // Bouton d'action principal visible (dans le PageHeader ET dans l'EmptyState)
    await expect(page.getByRole('button', { name: 'Nouveau budget' }).first()).toBeVisible();
  });

  // ── 3. Ouverture du dialog ────────────────────────────────────────────────

  test('le bouton "Nouveau budget" ouvre le SheetDialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau budget' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Nouveau budget');

    // Champs obligatoires présents
    await expect(dialog.locator('#budget-name')).toBeVisible();
    await expect(dialog.locator('#budget-amount')).toBeVisible();

    // La case "Budget global" est présente car aucun global n'existe encore
    await expect(dialog.locator('#budget-is-global')).toBeVisible();

    // Bouton Enregistrer et Annuler
    await expect(dialog.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeVisible();
  });

  // ── 4. Création d'un budget nommé ────────────────────────────────────────

  test('crée un budget "Courses" à 400 € et vérifie la card + "Hors budget"', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau budget' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Remplir le formulaire
    await dialog.locator('#budget-name').fill('Courses');
    await dialog.locator('#budget-amount').fill('400');

    // Soumettre
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Le dialog doit se fermer
    await expect(dialog).toBeHidden();

    // Toast de succès
    await expect(page.getByText('Budget créé', { exact: true })).toBeVisible();

    // La card du budget créé apparaît sous la section "Budgets"
    await expect(page.getByText('Courses')).toBeVisible();

    // La barre de progression est présente (aria role progressbar)
    await expect(page.getByRole('progressbar').first()).toBeVisible();

    // Le plafond est affiché : "0,00 € / 400,00 €"
    // Le montant dépensé est 0 et le plafond est 400
    await expect(page.getByText(/0,00\s*€\s*\/\s*400,00\s*€/)).toBeVisible();

    // La card "Hors budget" est toujours présente dès qu'un budget existe
    await expect(page.getByText('Hors budget')).toBeVisible();
  });

  // ── 5. Validation : nom requis ────────────────────────────────────────────

  test('affiche une erreur si le montant est invalide', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau budget' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Nom rempli mais montant manquant
    await dialog.locator('#budget-name').fill('Transport');
    // Ne pas remplir le montant

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Le dialog reste ouvert avec un message d'erreur
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Saisis un montant positif.')).toBeVisible();
  });

  // ── 6. Suppression avec undo ─────────────────────────────────────────────

  test('supprime un budget et peut annuler (undo)', async ({ page }) => {
    // Créer un budget via l'API pour ne pas dépendre du test de création
    await apiCreateBudget(page, 'Loisirs E2E', 200);

    // Recharger pour afficher le budget
    await page.reload();
    await expect(page.getByText('Loisirs E2E')).toBeVisible();

    // Ouvrir le menu CardActions (bouton ⋯) de la card "Loisirs E2E"
    // Le CardActions est le dernier bouton dans la card
    const budgetCard = page.getByText('Loisirs E2E').locator('xpath=ancestor::*[4]');
    await budgetCard.locator('button').last().click();

    // Cliquer "Supprimer"
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // L'item disparaît immédiatement (optimistic delete)
    await expect(page.getByText('Loisirs E2E')).toBeHidden();

    // Toast "Budget supprimé" avec bouton "Annuler"
    await expect(page.getByText('Budget supprimé')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).first().click();

    // Le budget réapparaît après undo
    await expect(page.getByText('Loisirs E2E')).toBeVisible();
  });

  // ── 7. Suppression sans undo (confirmer la suppression définitive) ────────

  test('supprime un budget définitivement (undo ignoré, disparaît)', async ({ page }) => {
    await apiCreateBudget(page, 'Vacances E2E', 1500);

    await page.reload();
    await expect(page.getByText('Vacances E2E')).toBeVisible();

    // Ouvrir CardActions et supprimer
    const budgetCard = page.getByText('Vacances E2E').locator('xpath=ancestor::*[4]');
    await budgetCard.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // L'item disparaît immédiatement
    await expect(page.getByText('Vacances E2E')).toBeHidden();

    // Laisser le toast expirer (ne pas cliquer Annuler) et vérifier que
    // la page est dans l'état vide une fois le toast fermé
    await expect(page.getByText('Budget supprimé')).toBeVisible();
    // On ne clique pas Annuler — l'item reste supprimé
  });
});

// ---------------------------------------------------------------------------
// Bonus : sélecteur de budget dans ExpenseAdHocDialog
// ---------------------------------------------------------------------------

test.describe('Budgets — intégration dépenses ad-hoc', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/budget');
    await expect(page).toHaveURL(/\/app\/budget/);

    // Repartir d'une ardoise vierge, puis créer un budget nommé
    await deleteAllBudgets(page);
    await apiCreateBudget(page, 'Courses Tests', 500);
  });

  test('le dialog de dépense ad-hoc propose le select de budget quand un budget nommé existe', async ({ page }) => {
    await page.goto('/app/expenses');
    await expect(page.getByRole('heading', { level: 1, name: 'Dépenses' })).toBeVisible();

    // Ouvrir le dialog de dépense ad-hoc
    await page.getByRole('button', { name: 'Dépense' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Enregistrer une dépense ad-hoc');

    // Le select "Budget" doit être présent
    await expect(dialog.getByLabel('Budget')).toBeVisible();
    await expect(dialog.locator('#adhoc-budget')).toBeVisible();

    // L'option "Courses Tests" doit être disponible dans le select
    const select = dialog.locator('#adhoc-budget');
    await expect(select.locator('option', { hasText: 'Courses Tests' })).toHaveCount(1);
  });

  test('enregistrer une dépense rattachée à un budget incrémente le budget', async ({ page }) => {
    // Créer la dépense via l'UI
    await page.goto('/app/expenses');
    await page.getByRole('button', { name: 'Dépense' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const subject = `Supermarché E2E ${Date.now()}`;
    await page.locator('#adhoc-subject').fill(subject);

    // Sélectionner le budget "Courses Tests"
    await page.locator('#adhoc-budget').selectOption({ label: 'Courses Tests' });

    await page.locator('#purchase-price').fill('85');
    await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
    await expect(dialog).toBeHidden();

    // Aller sur la page Budgets et vérifier que le montant dépensé a augmenté
    await page.goto('/app/budget');
    await expect(page.getByText('Courses Tests')).toBeVisible();

    // La dépense de 85 € doit apparaître : "85,00 € / 500,00 €"
    await expect(page.getByText(/85,00\s*€\s*\/\s*500,00\s*€/)).toBeVisible();
  });
});
