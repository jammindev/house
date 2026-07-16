/**
 * Tests E2E — Détail projet enrichi (parcours 20)
 *
 * Couvre :
 *   1. Onglets adaptatifs (TabShell) : un projet vide n'affiche que "Aperçu" ;
 *      le menu « + » expose les onglets masqués ; après création d'une tâche liée
 *      l'onglet "Tâches" apparaît dans la barre.
 *   2. Photos avant/après (EntityPhotosTab) : upload, déplacement de phase,
 *      bouton "Comparer" conditionnel.
 *
 * Pré-requis :
 *   - seed_demo_data peuple le projet "Rénovation salle de bain" (avec tab_counts
 *     non nuls). On crée un projet vierge via l'API dans chaque groupe de tests
 *     pour les assertions d'onglets adaptatifs.
 *   - Un fichier image de test existe dans e2e/fixtures/test-photo.jpg.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PHOTO = path.resolve(__dirname, 'fixtures/test-photo.jpg');

// ---------------------------------------------------------------------------
// API helper — creates a blank project via REST (no UI noise)
// ---------------------------------------------------------------------------

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

interface ProjectStub {
  id: string;
  title: string;
}

/**
 * Creates a blank project via the REST API and returns its id + title.
 * Navigates to a blank page first to ensure localStorage is available
 * (storageState is loaded per-test by Playwright's config).
 */
async function createBlankProject(
  page: import('@playwright/test').Page,
  title: string,
): Promise<ProjectStub> {
  // Ensure we're on the app domain so localStorage (JWT) is accessible
  if (!page.url().includes('/app/')) {
    await page.goto('/app/projects');
  }
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/projects/projects/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { title, status: 'active', type: 'other', priority: 3 },
  });
  if (!resp.ok()) {
    throw new Error(`Cannot create project "${title}": ${resp.status()}`);
  }
  return (await resp.json()) as ProjectStub;
}

/**
 * Deletes a project via the REST API (cleanup after test).
 */
async function deleteProject(
  page: import('@playwright/test').Page,
  projectId: string,
): Promise<void> {
  const token = await getAccessToken(page);
  await page.request.delete(`/api/projects/projects/${projectId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ---------------------------------------------------------------------------
// Onglets adaptatifs (TabShell)
// ---------------------------------------------------------------------------

test.describe('Onglets adaptatifs (TabShell)', () => {
  let projectId = '';

  test.beforeEach(async ({ page }) => {
    const title = `Projet onglets E2E ${Date.now()}`;
    const proj = await createBlankProject(page, title);
    projectId = proj.id;
    await page.goto(`/app/projects/${projectId}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    if (projectId) {
      await deleteProject(page, projectId);
    }
  });

  test('un projet vierge n\'affiche que l\'onglet "Aperçu" dans la barre', async ({ page }) => {
    // Only the Overview tab pill should be visible in the tab bar
    await expect(page.getByRole('button', { name: 'Aperçu' })).toBeVisible();

    // Adaptive tabs are hidden when empty — no individual pills for Tasks, Photos, etc.
    await expect(page.getByRole('button', { name: 'Tâches' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Photos' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Notes' })).not.toBeVisible();
  });

  test('le menu « + » est présent et liste les onglets masqués', async ({ page }) => {
    // The dashed « + » button (aria-label = "Afficher plus") must be visible
    const moreBtn = page.getByRole('button', { name: 'Afficher plus' });
    await expect(moreBtn).toBeVisible();

    // Opening it exposes the hidden tabs as dropdown items
    await moreBtn.click();
    await expect(page.getByRole('menuitem', { name: 'Tâches' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Photos' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Notes' })).toBeVisible();
  });

  test('cliquer un onglet dans le menu « + » l\'active', async ({ page }) => {
    await page.getByRole('button', { name: 'Afficher plus' }).click();
    await page.getByRole('menuitem', { name: 'Photos' }).click();

    // Photos tab is now active: its upload button should appear in the content
    await expect(page.getByRole('button', { name: 'Ajouter une photo' })).toBeVisible();
  });

  test('l\'onglet "Tâches" apparaît dans la barre après création d\'une tâche liée', async ({
    page,
    createTask,
  }) => {
    // Open the Tasks tab via the « + » menu first so the panel is visible
    await page.getByRole('button', { name: 'Afficher plus' }).click();
    await page.getByRole('menuitem', { name: 'Tâches' }).click();

    // Create a task from the Tasks panel
    const subject = `Tâche onglet adaptatif E2E ${Date.now()}`;
    await createTask(subject);

    // The project detail refreshes tab_counts after task creation.
    // The Tasks pill should now appear in the tab bar (not just in the « + » dropdown).
    await expect(page.getByRole('button', { name: 'Tâches' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Photos avant/après (EntityPhotosTab)
// ---------------------------------------------------------------------------

test.describe('Photos avant/après (EntityPhotosTab)', () => {
  let projectId = '';

  test.beforeEach(async ({ page }) => {
    const title = `Projet photos E2E ${Date.now()}`;
    const proj = await createBlankProject(page, title);
    projectId = proj.id;

    // Navigate to the project detail and open the Photos tab via the « + » menu
    await page.goto(`/app/projects/${projectId}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Afficher plus' }).click();
    await page.getByRole('menuitem', { name: 'Photos' }).click();

    // Confirm we are on the Photos tab
    await expect(page.getByRole('button', { name: 'Ajouter une photo' })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    if (projectId) {
      await deleteProject(page, projectId);
    }
  });

  test('l\'onglet Photos affiche l\'état vide', async ({ page }) => {
    await expect(
      page.getByText('Aucune photo. Ajoutez-en pour documenter l\'avant et l\'après du projet.'),
    ).toBeVisible();
  });

  test('uploade une photo et la voit dans la section "Non classées"', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajouter une photo' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.locator('#upload-file').setInputFiles(FIXTURE_PHOTO);
    await dialog.getByRole('button', { name: 'Téléverser' }).click();

    // Dialog closes after successful upload
    await expect(dialog).toBeHidden();

    // Photo appears in the "Non classées" section
    await expect(page.getByText('Non classées')).toBeVisible();
    await expect(page.locator('main img').first()).toBeVisible();
  });

  test('déplace une photo vers la section "Après" via le menu de la vignette', async ({
    page,
  }) => {
    // Upload a photo first
    await page.getByRole('button', { name: 'Ajouter une photo' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#upload-file').setInputFiles(FIXTURE_PHOTO);
    await dialog.getByRole('button', { name: 'Téléverser' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Non classées')).toBeVisible();

    // Open the photo tile's CardActions menu (last button inside the tile).
    // We scope to the "Non classées" section to avoid ambiguity.
    const section = page.locator('section').filter({ hasText: 'Non classées' });
    const tile = section.locator('[class*="overflow-hidden"]').first();
    await tile.locator('button').last().click();

    // Click "Déplacer vers Après" in the dropdown
    await page.getByRole('menuitem', { name: /Déplacer vers Après/ }).click();

    // The photo should now appear in the "Après" section
    await expect(page.getByText('Après')).toBeVisible();

    // "Non classées" section should have disappeared
    await expect(page.getByText('Non classées')).not.toBeVisible();
  });

  test('le bouton "Comparer" n\'apparaît pas avec une seule phase remplie', async ({ page }) => {
    // Upload a photo and move it to "Avant"
    await page.getByRole('button', { name: 'Ajouter une photo' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('#upload-file').setInputFiles(FIXTURE_PHOTO);
    await dialog.getByRole('button', { name: 'Téléverser' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Non classées')).toBeVisible();

    const section = page.locator('section').filter({ hasText: 'Non classées' });
    const tile = section.locator('[class*="overflow-hidden"]').first();
    await tile.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Déplacer vers Avant/ }).click();
    await expect(page.getByText('Avant')).toBeVisible();

    // Only "Avant" is populated — "Comparer" must NOT appear
    await expect(page.getByRole('button', { name: 'Comparer' })).not.toBeVisible();
  });

  test('le bouton "Comparer" apparaît avec une photo "Avant" et une "Après", et ouvre le comparateur', async ({
    page,
  }) => {
    // --- Photo 1 → "Avant" ---
    await page.getByRole('button', { name: 'Ajouter une photo' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('#upload-file').setInputFiles(FIXTURE_PHOTO);
    await dialog.getByRole('button', { name: 'Téléverser' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Non classées')).toBeVisible();

    let section = page.locator('section').filter({ hasText: 'Non classées' });
    let tile = section.locator('[class*="overflow-hidden"]').first();
    await tile.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Déplacer vers Avant/ }).click();
    await expect(page.getByText('Avant')).toBeVisible();

    // --- Photo 2 → "Après" ---
    await page.getByRole('button', { name: 'Ajouter une photo' }).click();
    dialog = page.getByRole('dialog');
    await dialog.locator('#upload-file').setInputFiles(FIXTURE_PHOTO);
    await dialog.getByRole('button', { name: 'Téléverser' }).click();
    await expect(dialog).toBeHidden();

    // The second photo lands in "Non classées"
    await expect(page.getByText('Non classées')).toBeVisible();
    section = page.locator('section').filter({ hasText: 'Non classées' });
    tile = section.locator('[class*="overflow-hidden"]').first();
    await tile.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Déplacer vers Après/ }).click();
    await expect(page.getByText('Après')).toBeVisible();

    // --- Both phases populated: "Comparer" button appears ---
    const compareBtn = page.getByRole('button', { name: 'Comparer' });
    await expect(compareBtn).toBeVisible();

    // Opening the comparator
    await compareBtn.click();
    const compareDialog = page.getByRole('dialog');
    await expect(compareDialog).toBeVisible();
    await expect(compareDialog.getByText('Avant / après')).toBeVisible();
    // The range-input slider for reveal is present
    await expect(compareDialog.locator('input[type="range"]')).toBeVisible();
  });
});
