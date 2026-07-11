import { test, expect } from '@playwright/test';

/**
 * Parcours 13 — Carnet de rénovation par zone.
 *
 * Couvre l'onglet "Rénovation" dans le détail d'une zone :
 *  - Affichage de l'onglet
 *  - État vide → EmptyState avec bouton d'ajout
 *  - Ouverture du RenovationDialog
 *  - Création d'une entrée (élément=floor, produit, marque)
 *  - Vérification de la card créée (badge élément, produit/marque, date)
 *  - Modification d'une entrée existante
 *  - Suppression avec undo
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/**
 * Récupère l'ID et le nom de la première zone disponible (Salon dans les données demo).
 */
async function getFirstZone(
  page: import('@playwright/test').Page,
): Promise<{ id: string; name: string }> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/zones/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await resp.json() as unknown;
  const zones: Array<{ id: string; name: string }> = Array.isArray(body)
    ? (body as Array<{ id: string; name: string }>)
    : ((body as { results?: Array<{ id: string; name: string }> }).results ?? []);
  const first = zones[0];
  if (!first) throw new Error('Aucune zone trouvée — vérifier que seed_demo_data a été exécuté');
  return { id: first.id, name: first.name };
}

/**
 * Supprime toutes les entrées de rénovation pour une zone donnée via l'API.
 * Permet d'isoler les tests sans dépendre de l'ordre.
 */
async function deleteAllRenovationEntries(
  page: import('@playwright/test').Page,
  zoneId: string,
): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get(
    `/api/interactions/interactions/?zone=${zoneId}&kind=renovation&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok()) return;
  const body = await resp.json() as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? (body as Array<{ id: string }>)
    : ((body as { items?: Array<{ id: string }>; results?: Array<{ id: string }> }).items
        ?? (body as { results?: Array<{ id: string }> }).results
        ?? []);
  for (const item of items) {
    await page.request.delete(`/api/interactions/interactions/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Carnet de rénovation — onglet Zone', () => {
  let zoneId: string;

  test.beforeEach(async ({ page }) => {
    // Naviguer d'abord pour que le JWT soit dans localStorage
    await page.goto('/app/zones');
    await expect(page).toHaveURL(/\/app\/zones/);

    const zone = await getFirstZone(page);
    zoneId = zone.id;

    // Nettoyer les entrées de rénovation pour partir d'un état vide
    await deleteAllRenovationEntries(page, zoneId);

    // Naviguer vers le détail de la zone
    await page.goto(`/app/zones/${zoneId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  // ── 1. Affichage de l'onglet ─────────────────────────────────────────────

  test('affiche l\'onglet Rénovation dans le détail d\'une zone', async ({ page }) => {
    // TabShell rend des FilterPill → boutons, pas des tabs ARIA
    await expect(page.getByRole('button', { name: 'Rénovation' })).toBeVisible();
  });

  // ── 2. État vide ─────────────────────────────────────────────────────────

  test('état vide : EmptyState avec bouton "Ajouter une entrée"', async ({ page }) => {
    await page.getByRole('button', { name: 'Rénovation' }).click();

    // L'EmptyState doit être visible
    await expect(page.getByText('Aucune entrée de rénovation')).toBeVisible();

    // Le bouton d'action de l'EmptyState
    await expect(page.getByRole('button', { name: 'Ajouter une entrée' }).first()).toBeVisible();
  });

  // ── 3. Ouverture du dialog ────────────────────────────────────────────────

  test('ouvre RenovationDialog depuis l\'état vide', async ({ page }) => {
    await page.getByRole('button', { name: 'Rénovation' }).click();
    await expect(page.getByText('Aucune entrée de rénovation')).toBeVisible();

    // Clic sur le bouton de l'EmptyState
    await page.getByRole('button', { name: 'Ajouter une entrée' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Nouvelle entrée de rénovation');

    // Vérifier les champs principaux
    await expect(dialog.locator('#reno-element')).toBeVisible();
    await expect(dialog.locator('#reno-type')).toBeVisible();
    await expect(dialog.locator('#reno-product')).toBeVisible();
    await expect(dialog.locator('#reno-brand')).toBeVisible();
    await expect(dialog.locator('#reno-reference')).toBeVisible();
    await expect(dialog.locator('#reno-date')).toBeVisible();
    await expect(dialog.locator('#reno-subject')).toBeVisible();
    await expect(dialog.locator('#reno-notes')).toBeVisible();

    // Bouton "Toute la maison"
    await expect(dialog.getByRole('button', { name: 'Toute la maison' })).toBeVisible();

    // Bouton submit
    await expect(dialog.getByRole('button', { name: 'Ajouter' })).toBeVisible();
  });

  test('ouvre RenovationDialog depuis le bouton de l\'en-tête de l\'onglet', async ({ page }) => {
    await page.getByRole('button', { name: 'Rénovation' }).click();

    // Bouton "Ajouter une entrée" dans l'en-tête (hors EmptyState)
    // Le bouton existe toujours en haut, même quand la liste est vide
    await page.getByRole('button', { name: 'Ajouter une entrée' }).first().click();

    await expect(page.getByRole('dialog')).toBeVisible();
  });

  // ── 4. Création d'une entrée ─────────────────────────────────────────────

  test('crée une entrée de rénovation (Sol — Parquet chêne, Panaget)', async ({ page }) => {
    await page.getByRole('button', { name: 'Rénovation' }).click();
    await expect(page.getByText('Aucune entrée de rénovation')).toBeVisible();

    // Ouvrir le dialog
    await page.getByRole('button', { name: 'Ajouter une entrée' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Sélectionner élément = Sol
    const elementSelect = dialog.locator('#reno-element');
    const solOption = elementSelect.locator('option:has-text("Sol")');
    await solOption.waitFor({ state: 'attached', timeout: 5_000 });
    await elementSelect.selectOption(await solOption.getAttribute('value') as string);

    // Remplir produit et marque
    await dialog.locator('#reno-product').fill('Parquet chêne');
    await dialog.locator('#reno-brand').fill('Panaget');

    // Soumettre
    await dialog.getByRole('button', { name: 'Ajouter' }).click();

    // Le dialog doit se fermer
    await expect(dialog).toBeHidden();

    // Toast de succès (getByText strict-mode : 2 éléments — div toast + span aria-live)
    await expect(page.getByText('Entrée de rénovation ajoutée', { exact: true })).toBeVisible();

    // La card doit apparaître avec le badge élément (exact pour éviter strict-mode avec le subject auto "Sol — Maison")
    await expect(page.getByText('Sol', { exact: true })).toBeVisible();

    // Le produit et la marque doivent être visibles
    await expect(page.getByText('Parquet chêne · Panaget')).toBeVisible();
  });

  test('crée une entrée avec une date et vérifie l\'affichage', async ({ page }) => {
    await page.getByRole('button', { name: 'Rénovation' }).click();

    await page.getByRole('button', { name: 'Ajouter une entrée' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Élément = Peinture (valeur par défaut), juste vérifier la date
    await dialog.locator('#reno-product').fill('Peinture mat ivoire');
    await dialog.locator('#reno-date').fill('2024-03-15');

    await dialog.getByRole('button', { name: 'Ajouter' }).click();
    await expect(dialog).toBeHidden();

    // La date formatée doit apparaître dans la card
    // toLocaleDateString() avec fr-FR → "15/03/2024"
    await expect(page.getByText('15/03/2024')).toBeVisible();
  });

  // ── 5. Modification ──────────────────────────────────────────────────────

  test('modifie une entrée de rénovation existante', async ({ page }) => {
    // D'abord, créer une entrée via l'API pour éviter de dépendre d'un autre test
    const token = await getAccessToken(page);
    const zone = await getFirstZone(page);

    await page.request.post('/api/interactions/interactions/renovation/', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        element: 'wall',
        interaction_type: 'repair',
        product: 'Enduit de rebouchage',
        brand: 'Polyfilla',
        zone_ids: [zone.id],
        occurred_at: '2024-06-01T00:00:00.000Z',
      },
    });

    // Recharger pour afficher l'entrée
    await page.goto(`/app/zones/${zoneId}`);
    await page.getByRole('button', { name: 'Rénovation' }).click();

    await expect(page.getByText('Enduit de rebouchage')).toBeVisible();

    // Ouvrir le menu CardActions — bouton ⋯ à droite de la card
    const card = page.getByText('Enduit de rebouchage').locator('xpath=ancestor::*[5]');
    await card.locator('button').last().click();

    // Cliquer "Modifier"
    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Modifier l\'entrée');

    // Modifier le produit
    await dialog.locator('#reno-product').fill('Enduit de lissage premium');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(dialog).toBeHidden();
    // Toast (strict-mode : div toast + span aria-live → utiliser exact)
    await expect(page.getByText('Entrée mise à jour', { exact: true })).toBeVisible();
    await expect(page.getByText('Enduit de lissage premium')).toBeVisible();
  });

  // ── 6. Suppression avec undo ─────────────────────────────────────────────

  test('supprime une entrée et peut annuler (undo)', async ({ page }) => {
    // Créer une entrée via l'API
    const token = await getAccessToken(page);

    await page.request.post('/api/interactions/interactions/renovation/', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        element: 'ceiling',
        interaction_type: 'maintenance',
        product: 'Enduit plafond E2E',
        zone_ids: [zoneId],
        occurred_at: new Date().toISOString(),
      },
    });

    await page.goto(`/app/zones/${zoneId}`);
    await page.getByRole('button', { name: 'Rénovation' }).click();

    await expect(page.getByText('Enduit plafond E2E')).toBeVisible();

    // Ouvrir le menu CardActions
    const card = page.getByText('Enduit plafond E2E').locator('xpath=ancestor::*[5]');
    await card.locator('button').last().click();

    // Cliquer "Supprimer"
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // L'entrée disparaît immédiatement (optimistic delete)
    await expect(page.getByText('Enduit plafond E2E')).toBeHidden();

    // Toast "Entrée supprimée" avec bouton "Annuler"
    await expect(page.getByText('Entrée supprimée')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).first().click();

    // L'entrée réapparaît après undo
    await expect(page.getByText('Enduit plafond E2E')).toBeVisible();
  });
});
