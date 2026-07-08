import { test, expect } from './fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/**
 * Crée une tâche via l'API REST.
 * Récupère la zone racine depuis /api/zones/ (zones non scoped sous tasks).
 */
async function apiCreateTask(
  page: import('@playwright/test').Page,
  subject: string,
  dueDate: string,
  status: string = 'pending',
): Promise<{ id: string }> {
  const token = await getAccessToken(page);

  // Les zones sont servies depuis /api/zones/
  const zonesResp = await page.request.get('/api/zones/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const zonesBody = await zonesResp.json() as unknown;
  const zones: Array<{ id: string }> = Array.isArray(zonesBody)
    ? (zonesBody as Array<{ id: string }>)
    : ((zonesBody as { results?: Array<{ id: string }> }).results ?? []);
  const zoneId = zones[0]?.id;
  if (!zoneId) throw new Error('No zone found for task creation');

  const resp = await page.request.post('/api/tasks/tasks/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { subject, zone_ids: [zoneId], due_date: dueDate, status },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to create task: ${resp.status()} ${await resp.text()}`);
  }
  return resp.json() as Promise<{ id: string }>;
}

async function apiDeleteTask(
  page: import('@playwright/test').Page,
  taskId: string,
): Promise<void> {
  const token = await getAccessToken(page);
  await page.request.delete(`/api/tasks/tasks/${taskId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ---------------------------------------------------------------------------
// 1. Affichage du dashboard
// ---------------------------------------------------------------------------

test.describe('Dashboard — affichage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
  });

  test('affiche la salutation h1 avec le prénom de l\'utilisateur', async ({ page }) => {
    await expect(page).toHaveURL(/\/app\/dashboard/);
    // "Bonjour Claire" — pattern de salutation
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bonjour');
  });

  test('affiche les boutons de quick actions principaux', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Dépense' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tâche' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Note' })).toBeVisible();
    await expect(page.getByRole('button', { name: "Demander à l'assistant" })).toBeVisible();
  });

  test('affiche "Ma semaine" (card toujours rendue)', async ({ page }) => {
    // La card Ma semaine est toujours affichée — soit avec des tâches, soit l'état vide
    await expect(page.getByText('Ma semaine')).toBeVisible();
  });

  test('les données demo de projets actifs sont visibles', async ({ page }) => {
    // Le seed crée "Rénovation salle de bain" comme projet actif
    await expect(page.getByText('Projets actifs')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Rénovation salle de bain')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Quick action Tâche — ouvre le dialog
// ---------------------------------------------------------------------------

test.describe('Dashboard — quick action Tâche', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
  });

  test('le bouton Tâche ouvre le dialog de création', async ({ page }) => {
    await page.getByRole('button', { name: 'Tâche' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder('Titre de la tâche…')).toBeVisible();
  });

  test('crée une tâche via le dashboard → apparaît dans "Ma semaine"', async ({ page }) => {
    const subject = `Tâche dashboard E2E ${Date.now()}`;
    const dueDate = isoDateOffset(3); // dans 3 jours → dans la fenêtre de 7 jours

    await page.getByRole('button', { name: 'Tâche' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder('Titre de la tâche…').fill(subject);
    await page.locator('#task-date').fill(dueDate);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // Toast de confirmation (exact pour éviter la collision avec span aria-live)
    await expect(page.getByText('Tâche créée', { exact: true })).toBeVisible({ timeout: 5_000 });

    // La tâche doit apparaître dans "Ma semaine" (invalidation du cache déclenchée par onCreated)
    await expect(page.getByText(subject)).toBeVisible({ timeout: 8_000 });

    // Nettoyage via l'API
    const token = await getAccessToken(page);
    const resp = await page.request.get('/api/tasks/tasks/', {
      headers: { Authorization: `Bearer ${token}` },
      params: { search: subject, limit: 5 },
    });
    const body = await resp.json() as unknown;
    const items: Array<{ id: string }> = Array.isArray(body)
      ? (body as Array<{ id: string }>)
      : ((body as { results?: Array<{ id: string }> }).results ?? []);
    for (const item of items) {
      await apiDeleteTask(page, item.id);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Cocher une tâche dans "Ma semaine" + undo
// ---------------------------------------------------------------------------

test.describe('Dashboard — Ma semaine : complétion et undo', () => {
  const subject = `Ma Semaine E2E ${Date.now()}`;
  const dueDate = isoDateOffset(2);
  let taskId = '';

  test.beforeEach(async ({ page }) => {
    // Naviguer d'abord pour avoir le JWT dans localStorage, puis créer via l'API
    await page.goto('/app/dashboard');
    const created = await apiCreateTask(page, subject, dueDate);
    taskId = created.id;
    await page.reload();
    await expect(page.getByText(subject)).toBeVisible({ timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    if (taskId) {
      // Si la tâche a été marquée done, elle reste dans la DB : on la supprime quand même
      try {
        await apiDeleteTask(page, taskId);
      } catch {
        // Ignore si déjà supprimée
      }
      taskId = '';
    }
  });

  test('cocher la tâche → elle disparaît de la liste + toast Annuler', async ({ page }) => {
    // Bouton rond aria-label "Marquer … comme terminée"
    const markDoneBtn = page.getByRole('button', {
      name: new RegExp(`Marquer.*comme terminée`),
    }).first();
    await expect(markDoneBtn).toBeVisible({ timeout: 5_000 });
    await markDoneBtn.click();

    // Le lien de tâche (dans la card Ma semaine) doit disparaître
    // On cible le lien vers la tâche spécifiquement pour éviter le toast qui contient aussi le sujet
    const taskLink = page.getByRole('link', { name: subject });
    await expect(taskLink).not.toBeVisible({ timeout: 5_000 });

    // Toast visible avec un titre contenant le sujet (utiliser .first() pour éviter le span aria-live)
    await expect(page.getByText(new RegExp(`.*${subject.substring(0, 20)}.*terminée`)).first()).toBeVisible({ timeout: 5_000 });
  });

  test('undo de la complétion → la tâche réapparaît dans "Ma semaine"', async ({ page }) => {
    const markDoneBtn = page.getByRole('button', {
      name: new RegExp(`Marquer.*comme terminée`),
    }).first();
    await expect(markDoneBtn).toBeVisible({ timeout: 5_000 });
    await markDoneBtn.click();

    // Attendre la disparition du lien de tâche
    const taskLink = page.getByRole('link', { name: subject });
    await expect(taskLink).not.toBeVisible({ timeout: 5_000 });

    // Cliquer le bouton Annuler dans le toast (action button du toast)
    // Le toast a un bouton d'action "Annuler" — on cherche le bouton dans le toast container
    const toastUndo = page.getByRole('button', { name: 'Annuler' }).first();
    await expect(toastUndo).toBeVisible({ timeout: 5_000 });
    await toastUndo.click();

    // La tâche doit réapparaître dans "Ma semaine" (lien redevient visible)
    await expect(taskLink).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 4. Quick action Note — navigation
// ---------------------------------------------------------------------------

test.describe('Dashboard — quick action Note', () => {
  test('le bouton Note navigue vers /app/interactions/new?type=note', async ({ page }) => {
    await page.goto('/app/dashboard');
    await page.getByRole('button', { name: 'Note' }).click();
    await expect(page).toHaveURL(/\/app\/interactions\/new\?type=note/);
  });
});

// ---------------------------------------------------------------------------
// 5. Bloc "À traiter" (TriageSection) — visible si des tâches sont en retard
// ---------------------------------------------------------------------------

test.describe('Dashboard — bloc "À traiter"', () => {
  const overdueSubject = `En retard Dashboard E2E ${Date.now()}`;
  let overdueTaskId = '';

  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    // Crée une tâche avec une date passée (overdue)
    const pastDate = isoDateOffset(-3);
    const created = await apiCreateTask(page, overdueSubject, pastDate, 'pending');
    overdueTaskId = created.id;
    await page.reload();
  });

  test.afterEach(async ({ page }) => {
    if (overdueTaskId) {
      try {
        await apiDeleteTask(page, overdueTaskId);
      } catch {
        // Ignore
      }
      overdueTaskId = '';
    }
  });

  test('une tâche en retard fait apparaître le bloc "À traiter"', async ({ page }) => {
    // Le bloc apparaît si total > 0 dans /api/alerts/summary/
    await expect(page.getByText('À traiter')).toBeVisible({ timeout: 10_000 });
  });

  test('l\'item en retard est cliquable → navigue vers /app/tasks', async ({ page }) => {
    await expect(page.getByText('À traiter')).toBeVisible({ timeout: 10_000 });

    // La triage section affiche le titre de la tâche en retard (entity_url="/app/tasks")
    const triageItem = page.getByText(overdueSubject);
    await expect(triageItem).toBeVisible({ timeout: 5_000 });

    // L'item est un lien → clic navigue vers /app/tasks
    await triageItem.click();
    await expect(page).toHaveURL(/\/app\/tasks/);
  });
});

// ---------------------------------------------------------------------------
// 6. Cards métriques : comportement selon les données disponibles
// ---------------------------------------------------------------------------

test.describe('Dashboard — cards métriques conditionnelles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    // Attendre que le dashboard soit chargé
    await expect(page.getByText('Ma semaine')).toBeVisible({ timeout: 10_000 });
  });

  test('la card Électricité n\'est affichée que si des données de conso existent', async ({ page }) => {
    const token = await getAccessToken(page);
    const main = page.getByRole('main');

    // Vérifier si des compteurs existent
    const metersResp = await page.request.get('/api/electricity/meters/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const metersBody = await metersResp.json() as unknown;
    const meters: Array<{ id: string }> = Array.isArray(metersBody)
      ? (metersBody as Array<{ id: string }>)
      : ((metersBody as { results?: Array<{ id: string }> }).results ?? []);

    if (meters.length === 0) {
      // Aucun compteur → ElectricityCard retourne null
      // La sidebar a "Électricité" mais le main ne doit pas avoir la card métrique
      const elecInMain = main.getByText('Électricité', { exact: true });
      await expect(elecInMain).not.toBeVisible();
    } else {
      // Des compteurs existent → la card peut être visible si conso > 0
      // ElectricityCard est null si total_wh === 0, visible si > 0
      // On vérifie juste que la page est stable (pas d'assertion négative fragile)
      await expect(main.getByText('Ma semaine')).toBeVisible();
    }
  });

  test('la card Eau n\'est affichée que si au moins 2 relevés existent', async ({ page }) => {
    const token = await getAccessToken(page);
    const main = page.getByRole('main');

    const readingsResp = await page.request.get('/api/water/readings/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const readingsBody = await readingsResp.json() as unknown;
    const readings: Array<{ id: string }> = Array.isArray(readingsBody)
      ? (readingsBody as Array<{ id: string }>)
      : ((readingsBody as { results?: Array<{ id: string }> }).results ?? []);

    if (readings.length < 2) {
      // Moins de 2 relevés → WaterCard retourne null → pas de card Eau dans le main
      const waterInMain = main.getByText('Eau', { exact: true });
      await expect(waterInMain).not.toBeVisible();
    } else {
      // 2+ relevés → la card peut être visible si consommation > 0
      // On vérifie juste que la page est stable
      await expect(main.getByText('Ma semaine')).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Sections contextuelles (activité + projets actifs)
// ---------------------------------------------------------------------------

test.describe('Dashboard — sections contextuelles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page.getByText('Ma semaine')).toBeVisible({ timeout: 10_000 });
  });

  test('la section "Activité récente" est visible si des interactions existent', async ({ page }) => {
    const token = await getAccessToken(page);
    const resp = await page.request.get('/api/interactions/interactions/', {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 1 },
    });
    const body = await resp.json() as unknown;
    const items: Array<{ id: string }> = Array.isArray(body)
      ? (body as Array<{ id: string }>)
      : ((body as { results?: Array<{ id: string }> }).results ?? []);

    if (items.length > 0) {
      await expect(page.getByText('Activité récente')).toBeVisible();
      // Le lien "Toute l'activité" est visible
      await expect(page.getByRole('link', { name: "Toute l'activité" })).toBeVisible();
    }
    // Sinon la card est null (DB sans interactions)
  });

  test('la section "Projets actifs" affiche un lien vers /app/projects', async ({ page }) => {
    // Le foyer demo a des projets actifs
    await expect(page.getByText('Projets actifs')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('link', { name: 'Tous les projets' })).toBeVisible();
  });
});
