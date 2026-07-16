import { test, expect } from '@playwright/test';

/**
 * Liste de courses (`shopping`) — module optionnel, clé `shopping`.
 * URL : /app/shopping-list · Sidebar : "Liste de courses"
 *
 * Parcours couverts :
 *  1. Affichage de la page (titre, champ quick-add, état vide)
 *  2. Quick-add → l'article apparaît dans la liste "À acheter"
 *  3. Cocher → déplace l'article dans la section "Pris (N)" avec line-through
 *  4. Décocher → retour dans la liste principale
 *  5. Vider les cochés → la section "Pris" disparaît
 *  6. Modification via CardActions → dialog edit → label mis à jour
 *  7. Suppression avec undo (optimistic delete puis restauration)
 *  8. Ajout depuis une fiche article stock → badge "Stock", dedup toast
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retourne le JWT access token depuis localStorage.
 * À appeler APRÈS une navigation (le token n'est présent qu'une fois l'app initialisée).
 */
async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/**
 * Supprime tous les articles de la liste de courses via l'API.
 * Permet d'isoler chaque test sans dépendre de l'état hérité.
 */
async function clearShoppingList(page: import('@playwright/test').Page): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/shopping/items/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return;
  const body = await resp.json() as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? (body as Array<{ id: string }>)
    : ((body as { results?: Array<{ id: string }> }).results ?? []);
  for (const item of items) {
    await page.request.delete(`/api/shopping/items/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

/**
 * Crée un article directement via l'API (contourne le UI pour les tests qui
 * n'exercent pas la création).
 */
async function createShoppingItemViaApi(
  page: import('@playwright/test').Page,
  label: string,
  extra: { checked?: boolean } = {},
): Promise<string> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/shopping/items/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { label, checked: extra.checked ?? false },
  });
  const body = await resp.json() as { id: string };
  return body.id;
}

/**
 * Récupère l'ID du premier article stock disponible (issu de seed_demo_data).
 */
async function getFirstStockItemId(page: import('@playwright/test').Page): Promise<string | null> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/stock/items/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return null;
  const body = await resp.json() as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? (body as Array<{ id: string }>)
    : ((body as { results?: Array<{ id: string }> }).results ?? []);
  return items[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Liste de courses', () => {
  test.beforeEach(async ({ page }) => {
    // Naviguer d'abord pour initialiser l'app et avoir le token en localStorage.
    await page.goto('/app/shopping-list');
    await expect(page).toHaveURL(/\/app\/shopping-list/);

    // Nettoyer la liste pour partir d'un état déterministe.
    await clearShoppingList(page);

    // Recharger pour que la UI reflète la liste vide.
    await page.reload();
    await expect(page).toHaveURL(/\/app\/shopping-list/);
  });

  // ── 1. Affichage ──────────────────────────────────────────────────────────

  test('affiche la page avec le titre et le champ quick-add', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Liste de courses' })).toBeVisible();
    await expect(page.getByPlaceholder('Ajouter un article…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible();
  });

  test('affiche l\'état vide quand la liste est vide', async ({ page }) => {
    await expect(page.getByText('Votre liste de courses est vide')).toBeVisible();
  });

  test('le bouton Ajouter est désactivé tant que le champ est vide', async ({ page }) => {
    // Le champ est vide au départ (liste vidée dans beforeEach)
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeDisabled();

    // Dès qu'on saisit du texte, il s'active
    await page.getByPlaceholder('Ajouter un article…').fill('Lait');
    await expect(page.getByRole('button', { name: 'Ajouter' })).toBeEnabled();
  });

  test('la sidebar affiche bien le lien "Liste de courses"', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Liste de courses' })).toBeVisible();
  });

  // ── 2. Quick-add ─────────────────────────────────────────────────────────

  test('ajoute un article via le champ quick-add', async ({ page }) => {
    const label = `Lait demi-écrémé E2E ${Date.now()}`;

    await page.getByPlaceholder('Ajouter un article…').fill(label);
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Le champ se vide après ajout
    await expect(page.getByPlaceholder('Ajouter un article…')).toHaveValue('');

    // L'article apparaît dans la liste
    await expect(page.getByText(label)).toBeVisible();
  });

  test('ajoute un article via la touche Entrée', async ({ page }) => {
    const label = `Beurre E2E ${Date.now()}`;

    await page.getByPlaceholder('Ajouter un article…').fill(label);
    await page.keyboard.press('Enter');

    await expect(page.getByText(label)).toBeVisible();
  });

  // ── 3. Cocher → section "Pris" ────────────────────────────────────────────

  test('cocher un article le déplace dans la section "Pris" avec line-through', async ({ page }) => {
    const label = `Yaourts E2E ${Date.now()}`;
    await createShoppingItemViaApi(page, label);
    await page.reload();

    // L'article est dans la liste principale
    await expect(page.getByText(label)).toBeVisible();

    // Cocher via la checkbox (aria-label dynamique)
    const checkbox = page.getByRole('checkbox', { name: `Cocher ${label}` });
    await expect(checkbox).toBeVisible();
    await checkbox.check();

    // La section "Pris" apparaît avec le compteur
    await expect(page.getByText(/Pris \(1\)/i)).toBeVisible();

    // Le texte a le style line-through (class CSS "line-through" sur le span)
    const labelSpan = page.locator('span.line-through', { hasText: label });
    await expect(labelSpan).toBeVisible();
  });

  // ── 4. Décocher → retour dans la liste principale ─────────────────────────

  test('décocher un article le fait revenir dans la liste principale', async ({ page }) => {
    const label = `Fromage E2E ${Date.now()}`;
    await createShoppingItemViaApi(page, label, { checked: true });
    await page.reload();

    // L'article est dans la section "Pris"
    await expect(page.getByText(/Pris \(1\)/i)).toBeVisible();
    const labelSpan = page.locator('span.line-through', { hasText: label });
    await expect(labelSpan).toBeVisible();

    // Décocher
    const checkbox = page.getByRole('checkbox', { name: `Cocher ${label}` });
    await checkbox.uncheck();

    // La section "Pris" disparaît
    await expect(page.getByText(/Pris \(/)).toHaveCount(0);

    // L'article est revenu dans la liste sans line-through
    await expect(page.getByText(label)).toBeVisible();
    await expect(page.locator('span.line-through', { hasText: label })).toHaveCount(0);
  });

  // ── 5. Parcours complet : quick-add → cocher → vider les cochés ───────────

  test('parcours complet : ajouter → cocher → vider les cochés', async ({ page }) => {
    const label = `Jus d'orange E2E ${Date.now()}`;

    // Ajouter
    await page.getByPlaceholder('Ajouter un article…').fill(label);
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText(label)).toBeVisible();

    // Cocher
    const checkbox = page.getByRole('checkbox', { name: `Cocher ${label}` });
    await checkbox.check();
    await expect(page.getByText(/Pris \(1\)/i)).toBeVisible();

    // Vider les cochés
    await page.getByRole('button', { name: 'Vider les cochés' }).click();

    // L'article est supprimé, la section "Pris" disparaît
    await expect(page.getByText(/Pris \(/)).toHaveCount(0);
    await expect(page.getByText(label)).toHaveCount(0);

    // Toast de confirmation
    await expect(page.getByText('Articles cochés retirés')).toBeVisible();
  });

  test('"Vider les cochés" est suivi d\'un toast avec bouton Annuler qui restaure', async ({ page }) => {
    const label = `Pain de mie E2E ${Date.now()}`;
    await createShoppingItemViaApi(page, label, { checked: true });
    await page.reload();

    await expect(page.getByText(/Pris \(1\)/i)).toBeVisible();

    await page.getByRole('button', { name: 'Vider les cochés' }).click();
    await expect(page.getByText(label)).toHaveCount(0);

    // Toast "Articles cochés retirés" + bouton Annuler
    await expect(page.getByText('Articles cochés retirés')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).first().click();

    // L'article réapparaît après undo
    await expect(page.getByText(label)).toBeVisible();
  });

  // ── 6. Modification via CardActions ───────────────────────────────────────

  test('modifie un article via le menu CardActions', async ({ page }) => {
    const label = `Céréales E2E ${Date.now()}`;
    await createShoppingItemViaApi(page, label);
    await page.reload();

    await expect(page.getByText(label)).toBeVisible();

    // Ouvrir le menu CardActions (bouton ··· à droite de la card)
    // La card est un `<div role="…">` issu du composant Card ; le bouton last()
    // est le déclencheur du DropdownMenu (CardActions).
    const card = page.getByText(label, { exact: true }).locator('xpath=ancestor::*[4]');
    await card.locator('button').last().click();

    // Cliquer "Modifier"
    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    // Le SheetDialog s'ouvre avec le titre "Modifier l'article"
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Modifier l\'article');

    // Modifier le label
    const labelInput = dialog.getByLabel('Article *');
    await labelInput.clear();
    await labelInput.fill(`${label} — modifié`);

    // Ajouter une quantité et une unité
    await dialog.getByLabel('Quantité').fill('3');
    await dialog.getByLabel('Unité').fill('boîtes');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Le dialog se ferme et l'article mis à jour est visible
    await expect(dialog).toBeHidden();
    await expect(page.getByText(`${label} — modifié`)).toBeVisible();
    // La quantité + unité s'affichent sous le label
    await expect(page.getByText('3 boîtes')).toBeVisible();
  });

  // ── 7. Suppression avec undo ──────────────────────────────────────────────

  test('supprime un article et peut annuler (undo)', async ({ page }) => {
    const label = `Café E2E ${Date.now()}`;
    await createShoppingItemViaApi(page, label);
    await page.reload();

    await expect(page.getByText(label)).toBeVisible();

    // Ouvrir le menu CardActions
    const card = page.getByText(label, { exact: true }).locator('xpath=ancestor::*[4]');
    await card.locator('button').last().click();

    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // L'article disparaît immédiatement (optimistic delete)
    await expect(page.getByText(label)).toHaveCount(0);

    // Toast "Article retiré" avec bouton Annuler
    await expect(page.getByText('Article retiré')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).first().click();

    // L'article réapparaît après undo
    await expect(page.getByText(label)).toBeVisible();
  });

  test('supprime définitivement un article (sans undo)', async ({ page }) => {
    const label = `Thé vert E2E ${Date.now()}`;
    await createShoppingItemViaApi(page, label);
    await page.reload();

    const card = page.getByText(label, { exact: true }).locator('xpath=ancestor::*[4]');
    await card.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // Toast visible mais on ne clique pas Annuler → l'article reste supprimé
    await expect(page.getByText('Article retiré')).toBeVisible();

    // Recharger pour confirmer la suppression côté serveur
    await page.reload();
    await expect(page.getByText(label)).toHaveCount(0);
  });

  // ── 8. Ajout depuis une fiche stock ───────────────────────────────────────

  test('ajoute un article depuis une fiche stock — badge "Stock" visible', async ({ page }) => {
    // Récupérer l'ID du premier article stock
    const stockItemId = await getFirstStockItemId(page);
    if (!stockItemId) {
      test.skip(true, 'Aucun article stock disponible — vérifier seed_demo_data');
      return;
    }

    // Naviguer vers la fiche stock
    await page.goto(`/app/stock/${stockItemId}`);
    await expect(page).toHaveURL(/\/app\/stock\/[0-9a-f-]+/);

    // Chercher le bouton "Ajouter à la liste de courses" (CardActions ou bouton dédié)
    // Sur la page de détail, l'action se trouve dans le menu CardActions en haut
    await page.getByRole('button', { name: 'Ajouter à la liste de courses' }).click();

    // Toast de confirmation
    await expect(page.getByText(/ajouté à la liste de courses/i)).toBeVisible();

    // Naviguer vers la liste de courses pour vérifier
    await page.goto('/app/shopping-list');
    await expect(page).toHaveURL(/\/app\/shopping-list/);

    // Le badge "Stock" est visible sur la card
    await expect(page.getByText('Stock').first()).toBeVisible();
  });

  test('ajouter deux fois le même article stock → toast "déjà dans la liste"', async ({ page }) => {
    const stockItemId = await getFirstStockItemId(page);
    if (!stockItemId) {
      test.skip(true, 'Aucun article stock disponible — vérifier seed_demo_data');
      return;
    }

    // Premier ajout depuis la liste de stock
    await page.goto('/app/stock');
    await expect(page).toHaveURL(/\/app\/stock/);

    // Trouver la card de l'article et cliquer le menu CardActions
    // L'action "Ajouter à la liste de courses" est dans le dropdown du premier article
    const firstCard = page.locator('li').first();
    await firstCard.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Ajouter à la liste de courses' }).click();

    // Toast "ajouté"
    await expect(page.getByText(/ajouté à la liste de courses/i)).toBeVisible();

    // Second ajout du même article
    await firstCard.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Ajouter à la liste de courses' }).click();

    // Toast "déjà dans la liste"
    await expect(page.getByText(/déjà dans la liste/i)).toBeVisible();
  });
});
