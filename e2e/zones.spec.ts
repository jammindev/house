import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Zones — arborescence dense (redesign).
 *
 * Couvre :
 *  1. Affichage de l'arborescence (zone + sous-zone)
 *  2. Création d'une zone avec surface + note
 *  3. Pliage/dépliage d'une branche
 *  4. Persistance du pliage (sessionStorage `zones.collapsed`) à travers la navigation
 *  5. Recherche : filtre l'arbre, conserve les ancêtres, insensible aux accents
 *  6. Recherche sans résultat → message `zones.searchEmpty`
 *  7. Déplier/Replier tout désactivé pendant une recherche
 *  8. Édition d'une zone via le menu ⋯
 *  9. Suppression bloquée si la zone a des sous-zones
 *
 * Chaque test crée ses propres zones (noms suffixés d'un timestamp unique) —
 * aucune hypothèse sur le contenu préexistant du foyer de test, hormis la
 * racine "Maison" qui existe toujours.
 */

interface ApiZone {
  id: string;
  name: string;
  parent: string | null;
  color?: string;
  surface?: number | string | null;
  note?: string | null;
}

async function getAccessToken(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

async function apiCreateZone(
  page: Page,
  opts: { name: string; parent?: string | null; color?: string; surface?: number | null; note?: string },
): Promise<ApiZone> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/zones/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name: opts.name,
      parent: opts.parent ?? null,
      color: opts.color ?? '#60A5FA',
      surface: opts.surface ?? null,
      note: opts.note ?? '',
    },
  });
  if (!resp.ok()) {
    throw new Error(`apiCreateZone failed (${resp.status()}): ${await resp.text()}`);
  }
  return (await resp.json()) as ApiZone;
}

/**
 * Locator de la ligne d'arborescence d'une zone, à partir de son nom exact.
 * Le nom est le contenu texte direct du <Link> ; le conteneur de la ligne
 * (traits, chevron, pastille, méta, CardActions) est son parent immédiat.
 */
function getZoneRow(page: Page, name: string) {
  return page.getByText(name, { exact: true }).locator('xpath=ancestor::*[1]');
}

async function openZoneMenu(page: Page, name: string): Promise<void> {
  const row = getZoneRow(page, name);
  await row.locator('button').last().click();
}

test.describe('Zones — arborescence dense', () => {
  test.beforeEach(async ({ page }) => {
    // Naviguer d'abord pour que le JWT soit dans localStorage (requis pour les
    // appels API directs faits par les tests).
    await page.goto('/app/zones');
    await expect(page.getByRole('heading', { name: 'Zones' })).toBeVisible();
  });

  // ── 1. Affichage ──────────────────────────────────────────────────────────

  test('affiche l\'arborescence avec une zone et sa sous-zone', async ({ page }) => {
    const ts = Date.now();
    const parentName = `Salle E2E ${ts}`;
    const childName = `Recoin E2E ${ts}`;

    const parent = await apiCreateZone(page, { name: parentName });
    await apiCreateZone(page, { name: childName, parent: parent.id });

    await page.goto('/app/zones');
    await expect(page.getByRole('heading', { name: 'Zones' })).toBeVisible();

    await expect(page.getByText(parentName, { exact: true })).toBeVisible();
    await expect(page.getByText(childName, { exact: true })).toBeVisible();
  });

  // ── 2. Création avec surface et note ─────────────────────────────────────

  test('crée une zone avec surface et note, la surface s\'affiche sur sa ligne', async ({ page }) => {
    const ts = Date.now();
    const name = `Atelier E2E ${ts}`;

    await page.getByRole('button', { name: 'Nouvelle zone' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.locator('#zone-name').fill(name);
    await dialog.locator('#zone-surface').fill('24');
    await dialog.locator('#zone-note').fill('Note de test E2E');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText('24 m²', { exact: true })).toBeVisible();
  });

  // ── 3. Pliage masque la descendance ──────────────────────────────────────

  test('le pliage d\'une branche masque ses enfants, le dépliage les remontre', async ({ page }) => {
    const ts = Date.now();
    const parentName = `Combles E2E ${ts}`;
    const childName = `Grenier E2E ${ts}`;

    const parent = await apiCreateZone(page, { name: parentName });
    await apiCreateZone(page, { name: childName, parent: parent.id });

    await page.goto('/app/zones');
    await expect(page.getByText(childName, { exact: true })).toBeVisible();

    const parentRow = getZoneRow(page, parentName);
    const toggleButton = parentRow.getByRole('button', { name: 'Replier la zone' });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    await expect(page.getByText(childName, { exact: true })).toBeHidden();

    const expandButton = parentRow.getByRole('button', { name: 'Déplier la zone' });
    await expandButton.click();
    await expect(page.getByText(childName, { exact: true })).toBeVisible();
  });

  // ── 4. Persistance du pliage ──────────────────────────────────────────────

  test('le pliage persiste après avoir navigué puis être revenu sur la page', async ({ page }) => {
    const ts = Date.now();
    const parentName = `Sous-sol E2E ${ts}`;
    const childName = `Cave E2E ${ts}`;

    const parent = await apiCreateZone(page, { name: parentName });
    await apiCreateZone(page, { name: childName, parent: parent.id });

    await page.goto('/app/zones');
    await expect(page.getByText(childName, { exact: true })).toBeVisible();

    const parentRow = getZoneRow(page, parentName);
    await parentRow.getByRole('button', { name: 'Replier la zone' }).click();
    await expect(page.getByText(childName, { exact: true })).toBeHidden();

    // Naviguer ailleurs puis revenir — le pliage vit dans sessionStorage, pas
    // dans l'état du composant.
    await page.goto('/app/tasks');
    await expect(page.getByRole('heading', { name: 'Tâches' })).toBeVisible();

    await page.goto('/app/zones');
    await expect(page.getByRole('heading', { name: 'Zones' })).toBeVisible();
    await expect(page.getByText(parentName, { exact: true })).toBeVisible();
    await expect(page.getByText(childName, { exact: true })).toBeHidden();

    // La zone parente doit toujours porter le chevron "replié"
    const parentRowAfter = getZoneRow(page, parentName);
    await expect(parentRowAfter.getByRole('button', { name: 'Déplier la zone' })).toBeVisible();
  });

  // ── 5. Recherche : filtre + garde le chemin + insensible aux accents ────

  test('la recherche filtre l\'arbre, garde les ancêtres, et ignore les accents', async ({ page }) => {
    const ts = Date.now();
    // Le suffixe est collé sans espace pour que la recherche "etage" ne
    // matche que ce nom précis (accent retiré par normalizeQuery).
    const parentName = `Étage${ts}`;
    const childName = `Chambre E2E ${ts}`;
    const unrelatedName = `Buanderie E2E ${ts}`;

    const parent = await apiCreateZone(page, { name: parentName });
    await apiCreateZone(page, { name: childName, parent: parent.id });
    await apiCreateZone(page, { name: unrelatedName });

    await page.goto('/app/zones');
    await expect(page.getByText(parentName, { exact: true })).toBeVisible();
    await expect(page.getByText(unrelatedName, { exact: true })).toBeVisible();

    const searchInput = page.getByPlaceholder('Rechercher une zone…');
    await searchInput.fill('etage');

    // La zone recherchée (accent ignoré) et son descendant restent visibles.
    await expect(page.getByText(parentName, { exact: true })).toBeVisible();
    await expect(page.getByText(childName, { exact: true })).toBeVisible();
    // Une zone hors résultat disparaît.
    await expect(page.getByText(unrelatedName, { exact: true })).toBeHidden();
  });

  // ── 6. Recherche sans résultat ────────────────────────────────────────────

  test('une recherche sans résultat affiche le message dédié', async ({ page }) => {
    const ts = Date.now();
    const needle = `zzz-introuvable-${ts}`;

    const searchInput = page.getByPlaceholder('Rechercher une zone…');
    await searchInput.fill(needle);

    await expect(page.getByText(`Aucune zone ne correspond à « ${needle} ».`)).toBeVisible();
  });

  // ── 7. Déplier/Replier tout désactivé pendant une recherche ──────────────

  test('le bouton Déplier/Replier tout est désactivé pendant une recherche', async ({ page }) => {
    const ts = Date.now();
    const parentName = `Palier E2E ${ts}`;
    const childName = `Placard E2E ${ts}`;

    const parent = await apiCreateZone(page, { name: parentName });
    await apiCreateZone(page, { name: childName, parent: parent.id });

    await page.goto('/app/zones');
    await expect(page.getByText(parentName, { exact: true })).toBeVisible();

    const toggleAllButton = page.getByRole('button', { name: /Déplier tout|Replier tout/ });
    await expect(toggleAllButton).toBeEnabled();

    const searchInput = page.getByPlaceholder('Rechercher une zone…');
    await searchInput.fill(parentName);

    await expect(toggleAllButton).toBeDisabled();
  });

  // ── 8. Édition via le menu ⋯ ──────────────────────────────────────────────

  test('modifie la surface d\'une zone via le menu ⋯', async ({ page }) => {
    const ts = Date.now();
    const name = `Buvette E2E ${ts}`;

    await apiCreateZone(page, { name, surface: 10 });

    await page.goto('/app/zones');
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText('10 m²', { exact: true })).toBeVisible();

    await openZoneMenu(page, name);
    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#zone-surface')).toHaveValue('10');

    await dialog.locator('#zone-surface').fill('55');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('55 m²', { exact: true })).toBeVisible();
  });

  // ── 9. Suppression bloquée si sous-zones ─────────────────────────────────

  test('une zone avec des sous-zones ne peut pas être supprimée', async ({ page }) => {
    const ts = Date.now();
    const parentName = `Aile E2E ${ts}`;
    const childName = `Chambrette E2E ${ts}`;

    const parent = await apiCreateZone(page, { name: parentName });
    await apiCreateZone(page, { name: childName, parent: parent.id });

    await page.goto('/app/zones');
    await expect(page.getByText(parentName, { exact: true })).toBeVisible();

    await openZoneMenu(page, parentName);
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    await expect(
      page.getByText('Cette zone contient des sous-zones. Déplacez-les ou supprimez-les d\'abord.'),
    ).toBeVisible();

    // La zone reste affichée — la suppression n'a pas eu lieu.
    await expect(page.getByText(parentName, { exact: true })).toBeVisible();
  });
});
