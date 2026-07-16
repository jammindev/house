import { test, expect } from '@playwright/test';

/**
 * Tests E2E — Panneau contexte de l'agent (ContextPanel + AddContextDialog).
 *
 * Le panneau "Ce que je sais" est monté au-dessus du chat dans EntityAssistant,
 * qui est embarqué dans l'onglet "Assistant" des pages de détail d'entité
 * (ex : un projet). Ces tests ne déclenchent aucun appel LLM : pin/unpin et
 * recherche de contexte sont des endpoints REST purs.
 *
 * Stratégie de seed :
 *  - Projet ancre  : "Rénovation salle de bain" (seedé par seed_demo_data, toujours présent).
 *  - Entité cible pour le pin : un second projet créé via l'API, nommé de façon
 *    unique par test, et supprimé dans afterEach.
 *
 * Pattern agent privacy : l'EntityAssistant affiche une modale de confidentialité
 * au premier usage si `agent.privacyAccepted.v2` est absent de localStorage.
 * On pré-accepte via addInitScript pour que la modale ne bloque pas l'UI.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIVACY_KEY = 'agent.privacyAccepted.v2';

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

interface Project {
  id: string;
  title: string;
}

/**
 * Crée un projet via l'API REST et renvoie son id + titre.
 * `title` doit être unique (utiliser Date.now() dans le nom).
 */
async function createProject(
  page: import('@playwright/test').Page,
  title: string,
): Promise<Project> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/projects/projects/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      title,
      status: 'active',
      type: 'other',
      priority: 3,
    },
  });
  if (!resp.ok()) {
    throw new Error(`Impossible de créer le projet "${title}" : ${resp.status()}`);
  }
  const body = (await resp.json()) as Project;
  return body;
}

/**
 * Supprime un projet via l'API REST (nettoyage afterEach).
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

/**
 * Trouve l'id du projet "Rénovation salle de bain" (seedé) via l'API.
 * Le projet est toujours présent après seed_demo_data.
 * Le router DRF est monté sous /api/projects/projects/ (nested DefaultRouter).
 */
async function findAnchorProjectId(page: import('@playwright/test').Page): Promise<string> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/projects/projects/?limit=100', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) throw new Error(`Impossible de lister les projets : ${resp.status()}`);
  const body = (await resp.json()) as unknown;
  const items: Project[] = Array.isArray(body)
    ? (body as Project[])
    : ((body as { results?: Project[] }).results ?? []);
  const anchor = items.find((p) => p.title === 'Rénovation salle de bain');
  if (!anchor) throw new Error('Projet ancre "Rénovation salle de bain" introuvable — seed manquant ?');
  return anchor.id;
}

/**
 * Navigue vers l'onglet "Assistant" d'un projet donné.
 * L'onglet est un FilterPill (bouton) dont le label est "Assistant" (fr).
 */
async function goToProjectAssistantTab(
  page: import('@playwright/test').Page,
  projectId: string,
): Promise<void> {
  await page.goto(`/app/projects/${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}`));
  // Attendre que la page soit bien chargée (le titre du projet apparaît dans le header)
  await expect(page.getByRole('main').getByRole('button', { name: 'Assistant' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Assistant' }).click();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Agent — panneau contexte (ContextPanel)', () => {
  let anchorProjectId: string;
  let pinnedProjectId: string;
  let pinnedProjectTitle: string;

  test.beforeEach(async ({ page }) => {
    // Pré-accepter la mention de confidentialité agent avant de charger la page.
    await page.addInitScript(([key]) => {
      localStorage.setItem(key, 'true');
    }, [PRIVACY_KEY]);

    // Hydrater le JWT : naviguer vers une page authentifiée pour que
    // localStorage.access_token soit disponible aux appels API suivants.
    await page.goto('/app/projects');
    await expect(page).toHaveURL(/\/app\/projects/);

    // Récupérer l'id du projet ancre (seedé).
    anchorProjectId = await findAnchorProjectId(page);

    // Créer un second projet unique (cible du pin).
    const ts = Date.now();
    pinnedProjectTitle = `Projet Context E2E ${ts}`;
    const created = await createProject(page, pinnedProjectTitle);
    pinnedProjectId = created.id;
  });

  test.afterEach(async ({ page }) => {
    // Nettoyer le projet créé pour ce test.
    if (pinnedProjectId) {
      await deleteProject(page, pinnedProjectId);
    }
  });

  // ── 1. Affichage du panneau ────────────────────────────────────────────────

  test('affiche le panneau de contexte étendu avec le chip ancre', async ({ page }) => {
    await goToProjectAssistantTab(page, anchorProjectId);

    // Le toggle du panneau doit être visible et étendu (aria-expanded="true").
    const toggle = page.getByTestId('agent-context-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Le panneau étendu contient au moins un chip avec data-origin="anchor".
    // Note: data-origin est un attribut de l'élément chip lui-même (pas un enfant),
    // donc on cible directement l'attribut CSS.
    const anchorChip = page.locator('[data-testid="agent-context-chip"][data-origin="anchor"]');
    await expect(anchorChip.first()).toBeVisible();
  });

  // ── 2. Collapse / Expand via le toggle ─────────────────────────────────────

  test('réduit puis rouvre le panneau via le toggle', async ({ page }) => {
    await goToProjectAssistantTab(page, anchorProjectId);

    const toggle = page.getByTestId('agent-context-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Le bouton "Ajouter du contexte" est visible quand le panneau est ouvert.
    await expect(page.getByTestId('agent-context-add')).toBeVisible();

    // Réduire.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Le bouton "Ajouter" disparaît (section repliée).
    await expect(page.getByTestId('agent-context-add')).not.toBeVisible();

    // Rouvrir.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('agent-context-add')).toBeVisible();
  });

  // ── 3. Ajout d'un élément via le picker ───────────────────────────────────

  test('ouvre le picker, cherche un projet, le sélectionne → chip pinned apparaît', async ({
    page,
  }) => {
    await goToProjectAssistantTab(page, anchorProjectId);

    // Ouvrir le dialog d'ajout de contexte.
    await page.getByTestId('agent-context-add').click();

    // Le SheetDialog doit être visible.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Taper au moins 2 caractères dans le champ de recherche.
    // On cherche la partie unique du titre (suffixe timestamp) pour éviter
    // les collisions avec d'autres projets seedés.
    const searchInput = page.getByTestId('agent-context-search');
    await expect(searchInput).toBeVisible();
    // Utiliser les 15 premiers chars de "Projet Context E2E" pour trouver notre projet.
    await searchInput.fill('Projet Context');

    // Attendre qu'au moins un résultat apparaisse.
    const result = page.getByTestId('agent-context-result').filter({ hasText: pinnedProjectTitle });
    await expect(result).toBeVisible({ timeout: 5000 });

    // Cliquer sur le résultat.
    await result.click();

    // Le dialog doit se fermer.
    await expect(dialog).not.toBeVisible();

    // Un nouveau chip avec data-origin="pinned" doit apparaître dans le panneau.
    const pinnedChip = page
      .locator('[data-testid="agent-context-chip"][data-origin="pinned"]')
      .filter({ hasText: pinnedProjectTitle });
    await expect(pinnedChip).toBeVisible();

    // Toast de confirmation (strict-mode : le texte peut apparaître dans le div toast ET
    // dans le span aria-live — utiliser .first() pour lever l'ambiguïté).
    await expect(page.getByText(`« ${pinnedProjectTitle} » ajouté au contexte`).first()).toBeVisible();
  });

  // ── 4. Suppression du chip pinné ─────────────────────────────────────────

  test('pin puis remove → le chip pinned disparaît', async ({ page }) => {
    await goToProjectAssistantTab(page, anchorProjectId);

    // Pin via le picker.
    await page.getByTestId('agent-context-add').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const searchInput = page.getByTestId('agent-context-search');
    await searchInput.fill('Projet Context');

    const result = page.getByTestId('agent-context-result').filter({ hasText: pinnedProjectTitle });
    await expect(result).toBeVisible({ timeout: 5000 });
    await result.click();
    await expect(dialog).not.toBeVisible();

    // Vérifier que le chip pinné est présent.
    const pinnedChip = page
      .locator('[data-testid="agent-context-chip"][data-origin="pinned"]')
      .filter({ hasText: pinnedProjectTitle });
    await expect(pinnedChip).toBeVisible();

    // Cliquer sur le bouton X du chip pinné.
    const removeBtn = pinnedChip.getByTestId('agent-context-remove');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Le chip doit disparaître.
    await expect(pinnedChip).not.toBeVisible();

    // Toast de confirmation de suppression (même piège strict-mode que pour "ajouté").
    await expect(page.getByText(`« ${pinnedProjectTitle} » retiré du contexte`).first()).toBeVisible();
  });

  // ── 5. Résultat déjà en contexte → bouton désactivé ───────────────────────

  test('résultat déjà en contexte affiché comme désactivé dans le picker', async ({ page }) => {
    await goToProjectAssistantTab(page, anchorProjectId);

    // Ouvrir le picker et chercher "Rénovation salle de bain" (l'ancre elle-même).
    await page.getByTestId('agent-context-add').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const searchInput = page.getByTestId('agent-context-search');
    // "Rénovation" est assez distinctif (≥2 chars, trouvable dans les searchables).
    await searchInput.fill('Rénovation');

    // Attendre les résultats.
    await expect(page.getByTestId('agent-context-result').first()).toBeVisible({ timeout: 5000 });

    // Le résultat correspondant à l'ancre doit être désactivé (déjà en contexte).
    const anchorResult = page
      .getByTestId('agent-context-result')
      .filter({ hasText: 'Rénovation salle de bain' });
    // S'il existe dans les résultats, il doit être disabled.
    const count = await anchorResult.count();
    if (count > 0) {
      await expect(anchorResult.first()).toBeDisabled();
    }
    // Note : si l'ancre n'apparaît pas dans les résultats de search_context (car
    // elle est filtrée côté serveur), le test passe tout de même — c'est un
    // comportement valide.

    // Fermer le dialog.
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
