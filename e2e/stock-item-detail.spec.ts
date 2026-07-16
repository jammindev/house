import { test, expect } from '@playwright/test';

/**
 * Tests E2E — Page détail d'un article de stock (`/app/stock/:id`).
 *
 * Couvre :
 *  1. Navigation liste → détail via le titre de la card, retour via BackLink
 *  2. Affichage des infos de l'item sur la page détail
 *  3. Enregistrer un achat depuis la page détail → achat dans l'historique
 *  4. Suppression depuis la page détail → retour à la liste, item disparu
 *  5. Accès direct par URL (deep-link)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

interface StockCategory {
  id: string;
  name: string;
}

interface StockItem {
  id: string;
  name: string;
}

/**
 * Crée une catégorie de stock via l'API et retourne son ID.
 */
async function createCategory(
  page: import('@playwright/test').Page,
  name: string,
): Promise<StockCategory> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/stock/categories/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { name, emoji: '📦', color: '#6366f1' },
  });
  if (!resp.ok()) throw new Error(`Impossible de créer la catégorie : ${resp.status()}`);
  return (await resp.json()) as StockCategory;
}

/**
 * Crée un article de stock via l'API et retourne son ID et son nom.
 */
async function createStockItem(
  page: import('@playwright/test').Page,
  {
    name,
    categoryId,
    unit = 'unité',
    quantity = '0',
    supplier = '',
  }: {
    name: string;
    categoryId: string;
    unit?: string;
    quantity?: string;
    supplier?: string;
  },
): Promise<StockItem> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/stock/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name,
      category: categoryId,
      unit,
      quantity,
      supplier: supplier || undefined,
    },
  });
  if (!resp.ok()) throw new Error(`Impossible de créer l'article : ${resp.status()}`);
  return (await resp.json()) as StockItem;
}

/**
 * Supprime un article de stock via l'API (nettoyage après test).
 */
async function deleteStockItem(
  page: import('@playwright/test').Page,
  itemId: string,
): Promise<void> {
  const token = await getAccessToken(page);
  await page.request.delete(`/api/stock/${itemId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Clé localStorage de la mention de confidentialité de l'assistant (EntityAssistant est
// embarqué dans la page détail — sans acceptation préalable une modale bloque l'UI).
const PRIVACY_KEY = 'agent.privacyAccepted.v2';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Stock — page détail article', () => {
  let categoryId: string;
  let itemId: string;
  let itemName: string;
  let categoryName: string;

  test.beforeEach(async ({ page }) => {
    // Accepter la mention de confidentialité de l'assistant dès le départ
    // pour éviter que la modale EntityAssistant bloque l'UI sur la page détail.
    await page.addInitScript(([key]) => {
      localStorage.setItem(key, 'true');
    }, [PRIVACY_KEY]);

    // Naviguer d'abord pour hydrater le JWT dans localStorage
    await page.goto('/app/stock');
    await expect(page).toHaveURL(/\/app\/stock/);

    // Noms uniques par test (Date.now() évalué dans beforeEach, pas à la déclaration)
    const ts = Date.now();
    categoryName = `Cat Détail E2E ${ts}`;
    itemName = `Article E2E Détail ${ts}`;

    // Créer catégorie + article via l'API pour un état propre et reproductible
    const cat = await createCategory(page, categoryName);
    categoryId = cat.id;

    const item = await createStockItem(page, {
      name: itemName,
      categoryId,
      unit: 'kg',
      quantity: '5',
      supplier: 'Fournisseur Test',
    });
    itemId = item.id;
  });

  test.afterEach(async ({ page }) => {
    // Nettoyage : supprimer l'article créé (la catégorie sera orpheline mais inoffensive)
    await deleteStockItem(page, itemId);
  });

  // ── 1. Navigation liste → détail via le titre de la card ─────────────────

  test('navigue vers la page détail depuis le titre de la card', async ({ page }) => {
    await page.goto('/app/stock');

    // S'assurer que l'onglet "Articles" est actif et que l'item est visible
    await page.getByRole('button', { name: 'Articles', exact: true }).click();
    await expect(page.getByText(itemName)).toBeVisible();

    // Cliquer sur le titre de la card (un lien)
    await page.getByRole('link', { name: itemName }).click();

    // On doit se trouver sur la page détail
    await expect(page).toHaveURL(new RegExp(`/app/stock/${itemId}`));
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible();
  });

  // ── 1b. Retour via BackLink ───────────────────────────────────────────────

  test('retourne à la liste via le BackLink', async ({ page }) => {
    // Naviguer depuis la liste (pour peupler location.state.back)
    await page.goto('/app/stock');
    await page.getByRole('button', { name: 'Articles', exact: true }).click();
    await expect(page.getByText(itemName)).toBeVisible();
    await page.getByRole('link', { name: itemName }).click();

    await expect(page).toHaveURL(new RegExp(`/app/stock/${itemId}`));

    // Cliquer sur le BackLink : quand on vient de la liste (pushBack), le texte est "Retour"
    await page.getByRole('main').getByRole('link', { name: 'Retour' }).click();

    // On doit être revenu sur la liste du stock
    await expect(page).toHaveURL(/\/app\/stock/);
    await expect(page.getByText(itemName)).toBeVisible();
  });

  // ── 2. Affichage des infos de l'item ─────────────────────────────────────

  test('affiche les informations de l\'article sur la page détail', async ({ page }) => {
    await page.goto(`/app/stock/${itemId}`);

    // Titre et badge statut
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible();
    // Le statut "En stock" doit être affiché (quantité = 5)
    await expect(page.getByText('En stock')).toBeVisible();

    // Catégorie dans le sous-titre
    await expect(page.getByText(categoryName)).toBeVisible();

    // Section "Détails de l'article"
    await expect(page.getByRole('heading', { name: "Détails de l'article" })).toBeVisible();

    // Champs de la grille d'infos : quantité + unité
    await expect(page.getByText('5 kg')).toBeVisible();

    // Fournisseur
    await expect(page.getByText('Fournisseur Test')).toBeVisible();

    // Section historique (vide au départ)
    await expect(page.getByRole('heading', { name: 'Historique des achats' })).toBeVisible();
    await expect(page.getByText('Aucun achat enregistré.')).toBeVisible();

    // Boutons d'action principaux
    await expect(page.getByRole('button', { name: 'Achat' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modifier' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supprimer' })).toBeVisible();
  });

  // ── 3. Enregistrer un achat → apparaît dans l'historique ─────────────────

  test('enregistre un achat depuis la page détail → visible dans l\'historique', async ({ page }) => {
    await page.goto(`/app/stock/${itemId}`);
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible();

    // Ouvrir le dialog d'achat depuis le bouton "Achat" du header
    await page.getByRole('button', { name: 'Achat' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Approvisionner');
    await expect(dialog).toContainText(itemName);

    // Remplir : 2,5 kg / 18.00 € / Grossiste E2E
    await dialog.locator('#purchase-delta').fill('2.5');
    await dialog.locator('#purchase-price').fill('18');
    await dialog.locator('#purchase-supplier').fill('Grossiste E2E');

    await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
    await expect(dialog).toBeHidden();

    // Toast de confirmation
    await expect(page.getByText('Achat enregistré', { exact: true })).toBeVisible();

    // L'achat doit apparaître dans la section "Historique des achats"
    await expect(page.getByText('Aucun achat enregistré.')).toBeHidden();
    // Le delta + unité est affiché dans le sous-titre de l'entrée d'historique
    await expect(page.getByText(/\+2\.?5\s*kg/)).toBeVisible();
    // Le fournisseur est affiché dans l'entrée d'historique (scoped à la section)
    const historySection = page.locator('section').filter({ hasText: 'Historique des achats' });
    await expect(historySection.getByText('Grossiste E2E')).toBeVisible();
    // Le montant (18.00 €) doit être visible dans l'historique
    await expect(historySection.getByText('18.00 €')).toBeVisible();
  });

  // ── 3b. Cliquer sur une entrée d'historique → édition de la dépense ──────

  test('clique sur une entrée d\'historique → ouvre l\'édition de la dépense', async ({ page }) => {
    await page.goto(`/app/stock/${itemId}`);
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible();

    // Enregistrer un achat pour peupler l'historique
    await page.getByRole('button', { name: 'Achat' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('#purchase-delta').fill('1');
    await dialog.locator('#purchase-price').fill('12');
    await dialog.locator('#purchase-supplier').fill('Grossiste Clic E2E');
    await dialog.getByRole('button', { name: "Enregistrer l'achat" }).click();
    await expect(dialog).toBeHidden();

    // Aller sur l'onglet Historique
    await page.getByRole('button', { name: 'Historique', exact: true }).click();

    // L'entrée d'historique doit être cliquable → navigue vers l'édition de l'interaction
    const historySection = page.locator('section').filter({ hasText: 'Historique des achats' });
    await historySection.getByText('Grossiste Clic E2E').click();

    await expect(page).toHaveURL(/\/app\/interactions\/[0-9a-f-]+\/edit/);
    await expect(page.getByRole('heading', { name: "Modifier l'activité" })).toBeVisible();
  });

  // ── 4. Suppression depuis la page détail ─────────────────────────────────

  test('supprime l\'article depuis la page détail et retourne à la liste', async ({ page }) => {
    await page.goto(`/app/stock/${itemId}`);
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible();

    // Cliquer sur le bouton Supprimer → ouvre le ConfirmDialog
    await page.getByRole('button', { name: 'Supprimer' }).click();

    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Êtes-vous sûr ?');

    // Confirmer la suppression
    await confirmDialog.getByRole('button', { name: 'Supprimer' }).click();

    // On doit être redirigé vers la liste
    await expect(page).toHaveURL(/\/app\/stock/);

    // L'article ne doit plus apparaître dans la liste
    await page.getByRole('button', { name: 'Articles', exact: true }).click();
    await expect(page.getByText(itemName)).toBeHidden();

    // Marquer l'item comme supprimé pour éviter l'erreur dans afterEach
    itemId = '';
  });

  // ── 5. Accès direct par URL (deep-link) ──────────────────────────────────

  test('accès direct par URL sans passer par la liste (deep-link)', async ({ page }) => {
    // Naviguer directement sans passer par /app/stock
    await page.goto(`/app/stock/${itemId}`);

    // La page doit se charger correctement
    await expect(page).toHaveURL(new RegExp(`/app/stock/${itemId}`));
    await expect(page.getByRole('heading', { level: 1, name: itemName })).toBeVisible();

    // Le BackLink doit afficher le fallback "Stock" (pas de state.back)
    // Cibler spécifiquement le BackLink dans le contenu principal (pas le lien de nav latérale)
    await expect(page.getByRole('main').getByRole('link', { name: 'Stock' })).toBeVisible();

    // Les sections principales sont présentes
    await expect(page.getByRole('heading', { name: "Détails de l'article" })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Historique des achats' })).toBeVisible();
  });
});
