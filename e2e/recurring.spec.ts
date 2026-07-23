import { test, expect } from '@playwright/test';

/**
 * Parcours 21 — Lot 2 : Dépenses récurrentes.
 *
 * Couvre :
 *  1. Navigation depuis /app/budget vers /app/budget/recurring via la link card
 *  2. État vide ("Aucune dépense récurrente")
 *  3. Création d'une récurrence avec échéance aujourd'hui → apparaît sous "À confirmer"
 *     + cartes de projection trésorerie (30/90 jours)
 *  4. Confirmation d'une occurrence → toast "confirmée" + disparaît de "À confirmer"
 *  5. Suppression via CardActions → toast "Récurrence supprimée" + carte absente
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/** Supprime toutes les dépenses récurrentes du foyer via l'API. */
async function deleteAllRecurring(page: import('@playwright/test').Page): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/budget/recurring/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return;
  const body = await resp.json() as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? (body as Array<{ id: string }>)
    : ((body as { results?: Array<{ id: string }> }).results ?? []);
  for (const item of items) {
    await page.request.delete(`/api/budget/recurring/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

/** Crée une dépense récurrente via l'API et retourne l'objet créé. */
async function apiCreateRecurring(
  page: import('@playwright/test').Page,
  label: string,
  amount: number,
  nextDueDate: string,
  cadence: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
): Promise<{ id: string; label: string }> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/budget/recurring/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      label,
      amount,
      cadence,
      next_due_date: nextDueDate,
      supplier: '',
      notes: '',
      budget_id: null,
    },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to create recurring expense: ${resp.status()} ${await resp.text()}`);
  }
  return resp.json() as Promise<{ id: string; label: string }>;
}

/** Retourne la date d'aujourd'hui au format YYYY-MM-DD. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Dépenses récurrentes — parcours 21 lot 2', () => {
  test.beforeEach(async ({ page }) => {
    // Hydrater le localStorage (JWT) avant tout appel API
    await page.goto('/app/budget');
    await expect(page).toHaveURL(/\/app\/budget/);

    // Repartir d'une ardoise vierge
    await deleteAllRecurring(page);
  });

  // ── 1. Navigation depuis /app/budget → /app/budget/recurring ─────────────

  test('la link card "Dépenses récurrentes" mène à /app/budget/recurring avec état vide', async ({ page }) => {
    // La link card n'apparaît qu'une fois l'overview chargé — attendre le titre
    await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible();

    // Cliquer sur la card "Dépenses récurrentes"
    await page.getByText('Dépenses récurrentes').click();

    await expect(page).toHaveURL(/\/app\/budget\/recurring/);

    // Titre de la page
    await expect(page.getByRole('heading', { level: 1, name: 'Dépenses récurrentes' })).toBeVisible();

    // Lien retour vers Budgets visible
    await expect(page.getByRole('link', { name: 'Budgets' })).toBeVisible();

    // Bouton d'action principal
    await expect(page.getByRole('button', { name: 'Nouvelle récurrence' })).toBeVisible();

    // État vide
    await expect(page.getByText('Aucune dépense récurrente')).toBeVisible();
  });

  // ── 2. Ouverture du SheetDialog ───────────────────────────────────────────

  test('le bouton "Nouvelle récurrence" ouvre le SheetDialog avec tous les champs', async ({ page }) => {
    await page.goto('/app/budget/recurring');
    await expect(page.getByRole('heading', { level: 1, name: 'Dépenses récurrentes' })).toBeVisible();

    await page.getByRole('button', { name: 'Nouvelle récurrence' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Nouvelle récurrence');

    // Champs obligatoires
    await expect(dialog.locator('#rec-label')).toBeVisible();
    await expect(dialog.locator('#rec-amount')).toBeVisible();
    await expect(dialog.locator('#rec-cadence')).toBeVisible();
    await expect(dialog.locator('#rec-due')).toBeVisible();

    // Champs optionnels
    await expect(dialog.locator('#rec-supplier')).toBeVisible();
    await expect(dialog.locator('#rec-notes')).toBeVisible();

    // Boutons du footer
    await expect(dialog.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeVisible();
  });

  // ── 3. Création avec échéance aujourd'hui → section "À confirmer" ─────────

  test('crée "Netflix" 15 € échéance aujourd\'hui → apparaît sous "À confirmer" avec bouton "Confirmer"', async ({ page }) => {
    await page.goto('/app/budget/recurring');
    await expect(page.getByRole('heading', { level: 1, name: 'Dépenses récurrentes' })).toBeVisible();

    await page.getByRole('button', { name: 'Nouvelle récurrence' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Remplir le formulaire
    await dialog.locator('#rec-label').fill('Netflix');
    await dialog.locator('#rec-amount').fill('15');
    // Cadence : laisser la valeur par défaut "Mensuelle"
    // Échéance : laisser la valeur par défaut (aujourd'hui)
    // Vérifier que la date pré-remplie est bien aujourd'hui
    const dueDateInput = dialog.locator('#rec-due');
    await expect(dueDateInput).toHaveValue(todayIso());

    // Soumettre
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Le dialog doit se fermer
    await expect(dialog).toBeHidden();

    // Toast de succès
    await expect(page.getByText('Récurrence créée')).toBeVisible();

    // La carte "Netflix" apparaît sous la section "À confirmer (1)"
    await expect(page.getByText(/À confirmer/)).toBeVisible();
    await expect(page.getByText('Netflix')).toBeVisible();

    // Le bouton "Confirmer" est présent sur la card
    await expect(page.getByRole('button', { name: 'Confirmer' })).toBeVisible();

    // Les cartes de projection trésorerie sont présentes
    await expect(page.getByText('30 prochains jours')).toBeVisible();
    await expect(page.getByText('90 prochains jours')).toBeVisible();
  });

  // ── 4. Validation : libellé requis ────────────────────────────────────────

  test('affiche une erreur si le libellé est vide', async ({ page }) => {
    await page.goto('/app/budget/recurring');
    await expect(page.getByRole('heading', { level: 1, name: 'Dépenses récurrentes' })).toBeVisible();

    await page.getByRole('button', { name: 'Nouvelle récurrence' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Montant rempli mais libellé vide
    await dialog.locator('#rec-amount').fill('20');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Le dialog reste ouvert avec l'erreur
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Merci d'indiquer un libellé.")).toBeVisible();
  });

  // ── 5. Confirmation d'une occurrence ─────────────────────────────────────

  test('confirme une occurrence → toast "confirmée" et carte sort de "À confirmer"', async ({ page }) => {
    // Créer directement via l'API pour ne pas dépendre du test de création
    await apiCreateRecurring(page, 'Spotify', 10, todayIso(), 'monthly');

    // Recharger pour afficher la récurrence
    await page.goto('/app/budget/recurring');
    await expect(page.getByRole('heading', { level: 1, name: 'Dépenses récurrentes' })).toBeVisible();
    await expect(page.getByText('Spotify')).toBeVisible();

    // La carte est bien dans "À confirmer"
    await expect(page.getByText(/À confirmer/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmer' })).toBeVisible();

    // Cliquer "Confirmer" sur la card Spotify
    await page.getByRole('button', { name: 'Confirmer' }).click();

    // Le ConfirmOccurrenceDialog s'ouvre
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Confirmer cette dépense');

    // Le champ "Montant payé" est pré-rempli avec 10
    await expect(confirmDialog.locator('#confirm-amount')).toHaveValue('10');

    // Valider avec le montant par défaut
    await confirmDialog.getByRole('button', { name: 'Confirmer' }).click();

    // Le dialog se ferme
    await expect(confirmDialog).toBeHidden();

    // Toast "confirmée" (interpolé : « Spotify » confirmée)
    await expect(page.getByText(/confirmée/)).toBeVisible();

    // La carte Spotify quitte la section "À confirmer"
    // Soit la section disparaît, soit la carte est déplacée dans "À venir"
    await expect(page.getByText(/À confirmer \(1\)/)).toBeHidden();
  });

  // ── 6. Suppression avec toast undo ───────────────────────────────────────

  test('supprime une récurrence via CardActions → toast "Récurrence supprimée" + carte absente', async ({ page }) => {
    // Créer directement via l'API
    await apiCreateRecurring(page, 'Disney+ E2E', 8, todayIso(), 'monthly');

    await page.goto('/app/budget/recurring');
    await expect(page.getByRole('heading', { level: 1, name: 'Dépenses récurrentes' })).toBeVisible();
    await expect(page.getByText('Disney+ E2E')).toBeVisible();

    // Ouvrir le menu CardActions (dernier bouton dans la card)
    const card = page.getByText('Disney+ E2E').locator('xpath=ancestor::*[4]');
    await card.locator('button').last().click();

    // Cliquer "Supprimer"
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // La carte disparaît immédiatement (optimistic delete)
    await expect(page.getByText('Disney+ E2E')).toBeHidden();

    // Toast "Récurrence supprimée"
    await expect(page.getByText('Récurrence supprimée')).toBeVisible();
  });

  // ── 7. Suppression + undo (restauration) ─────────────────────────────────

  test('suppression annulable : undo restaure la carte', async ({ page }) => {
    await apiCreateRecurring(page, 'Canal+ Undo', 25, todayIso(), 'monthly');

    await page.goto('/app/budget/recurring');
    await expect(page.getByText('Canal+ Undo')).toBeVisible();

    const card = page.getByText('Canal+ Undo').locator('xpath=ancestor::*[4]');
    await card.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // L'item disparaît
    await expect(page.getByText('Canal+ Undo')).toBeHidden();

    // Cliquer "Annuler" dans le toast
    await expect(page.getByText('Récurrence supprimée')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).first().click();

    // L'item réapparaît
    await expect(page.getByText('Canal+ Undo')).toBeVisible();
  });
});
