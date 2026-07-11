import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/**
 * Deletes all chickens for the household via the API so each test starts clean.
 * The chickens API is mounted at /api/chickens/ (DefaultRouter root registration).
 */
async function deleteAllChickens(page: import('@playwright/test').Page): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/chickens/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return;
  const body = (await resp.json()) as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? (body as Array<{ id: string }>)
    : ((body as { results?: Array<{ id: string }> }).results ?? []);
  for (const item of items) {
    await page.request.delete(`/api/chickens/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

/**
 * Deletes all egg logs for the household via the API.
 */
async function deleteAllEggLogs(page: import('@playwright/test').Page): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/chickens/egg-logs/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return;
  const body = (await resp.json()) as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? (body as Array<{ id: string }>)
    : ((body as { results?: Array<{ id: string }> }).results ?? []);
  for (const item of items) {
    await page.request.delete(`/api/chickens/egg-logs/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

const AGENT_PRIVACY_KEY = 'agent.privacyAccepted.v2';

/**
 * Pre-accept the agent privacy notice so it doesn't block tests that navigate
 * to chicken detail pages (which embed EntityAssistant).
 */
async function acceptAgentPrivacy(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(
    ([key]) => {
      localStorage.setItem(key, 'true');
    },
    [AGENT_PRIVACY_KEY],
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Poulailler', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so the JWT lands in localStorage, then clean state.
    await page.goto('/app/chickens');
    await expect(page).toHaveURL(/\/app\/chickens/);
    await deleteAllChickens(page);
    await deleteAllEggLogs(page);
    // Pre-accept agent privacy so the consent dialog doesn't block detail pages.
    await acceptAgentPrivacy(page);
    // Reload to reflect the clean state.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Poulailler' })).toBeVisible();
  });

  // ── 1. Création d'une poule ───────────────────────────────────────────────

  test('crée une poule et la voit apparaître dans la grille', async ({ page }) => {
    const chickenName = `Poule E2E ${Date.now()}`;

    // Two "Nouvelle poule" buttons exist when the list is empty (PageHeader + EmptyState action).
    await page.getByRole('button', { name: 'Nouvelle poule' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Ajouter une poule');

    await dialog.locator('#chicken-name').fill(chickenName);
    await dialog.locator('#chicken-breed').fill('Sussex');

    await dialog.getByRole('button', { name: 'Créer' }).click();

    // Dialog closes
    await expect(dialog).toBeHidden();

    // Toast success
    await expect(page.getByText('Poule ajoutée', { exact: true })).toBeVisible();

    // Card appears in the grid
    await expect(page.getByText(chickenName)).toBeVisible();
  });

  // ── 2. Logger la ponte du jour ────────────────────────────────────────────

  test('log 2 œufs via le bandeau, vérifier le compteur, puis remplacer par 3', async ({ page }) => {
    // Create a hen first (required for the page to have real data, banner is
    // always visible regardless).
    const token = await getAccessToken(page);
    await page.request.post('/api/chickens/', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: 'Poulette test', breed: '' },
    });
    await page.reload();

    // The banner starts at 0. Tap "+" twice → submit 2 eggs.
    const incrementBtn = page.getByRole('button', { name: 'Un œuf de plus' });
    await incrementBtn.click();
    await incrementBtn.click();

    // Counter shows 2 🥚
    await expect(page.getByText(/^2\s*🥚/)).toBeVisible();

    // Toast confirming the log — use .first() as two increments may stack two toasts
    await expect(page.getByText('Ponte enregistrée', { exact: true }).first()).toBeVisible();

    // Tap "+" once more → replace count with 3 (server upsert, not duplicate)
    await incrementBtn.click();

    await expect(page.getByText(/^3\s*🥚/)).toBeVisible();
    await expect(page.getByText('Ponte enregistrée', { exact: true }).first()).toBeVisible();

    // Verify no duplicate in the egg-log list (one row for today)
    const logsResp = await page.request.get('/api/chickens/egg-logs/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const logsBody = (await logsResp.json()) as unknown;
    const logs: Array<{ count: number }> = Array.isArray(logsBody)
      ? (logsBody as Array<{ count: number }>)
      : ((logsBody as { results?: Array<{ count: number }> }).results ?? []);
    expect(logs).toHaveLength(1);
    expect(logs[0].count).toBe(3);
  });

  // ── 3. Fiche poule — ajout d'un événement Soin ───────────────────────────

  test('ouvre la fiche poule et ajoute un événement Soin', async ({ page }) => {
    const chickenName = `Poule Fiche E2E ${Date.now()}`;
    const token = await getAccessToken(page);

    const createResp = await page.request.post('/api/chickens/', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: chickenName, breed: 'Marans' },
    });
    const created = (await createResp.json()) as { id: string };

    // Navigate directly to the detail page (no need to click through the list)
    await page.goto(`/app/chickens/${created.id}`);
    await expect(page).toHaveURL(/\/app\/chickens\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(chickenName);

    // Add a "Soin" event
    const eventTitle = `Vermifugation E2E ${Date.now()}`;
    await page.getByRole('button', { name: 'Événement' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Nouvel événement');

    // Type is already "Soin" by default — just fill the title
    await dialog.locator('#event-title').fill(eventTitle);
    await dialog.getByRole('button', { name: 'Créer' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Événement ajouté', { exact: true })).toBeVisible();

    // Event appears in the timeline
    await expect(page.getByText(eventTitle)).toBeVisible();
  });

  // ── 4. Changer le statut en "Décédée" → badge + événement auto ───────────

  test('change le statut à Décédée → badge et événement de décès dans la timeline', async ({
    page,
  }) => {
    const chickenName = `Poule Statut E2E ${Date.now()}`;
    const token = await getAccessToken(page);

    const createResp = await page.request.post('/api/chickens/', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: chickenName, breed: '' },
    });
    const created = (await createResp.json()) as { id: string };
    await page.goto(`/app/chickens/${created.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(chickenName);

    // Open edit dialog
    await page.getByRole('button', { name: 'Modifier' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Modifier la poule');

    // Select status "Décédée"
    await dialog.locator('#chicken-status').selectOption('deceased');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('Poule mise à jour', { exact: true })).toBeVisible();

    // The status badge should now read "Décédée"
    await expect(page.getByText('Décédée', { exact: true })).toBeVisible();

    // The service auto-creates a "death" type event in the timeline
    // The EventTimeline renders the type label "Décès"
    await expect(page.getByText('Décès')).toBeVisible();
  });

  // ── 5. Suppression d'un événement avec undo ───────────────────────────────

  test('supprime un événement et peut annuler (undo)', async ({ page }) => {
    const chickenName = `Poule Undo E2E ${Date.now()}`;
    const eventTitle = `Événement undo E2E ${Date.now()}`;
    const token = await getAccessToken(page);

    // Create a chicken
    const createResp = await page.request.post('/api/chickens/', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: chickenName, breed: '' },
    });
    const created = (await createResp.json()) as { id: string };

    // Create an event for it via the API
    await page.request.post('/api/chickens/events/', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        type: 'care',
        title: eventTitle,
        occurred_on: new Date().toISOString().slice(0, 10),
        chicken: created.id,
      },
    });

    await page.goto(`/app/chickens/${created.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(chickenName);
    await expect(page.getByText(eventTitle)).toBeVisible();

    // Open the CardActions menu on the event card — button is the last button
    // inside the card ancestor
    const eventCard = page.getByText(eventTitle).locator('xpath=ancestor::*[4]');
    await eventCard.locator('button').last().click();

    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // Event disappears (optimistic delete)
    await expect(page.getByText(eventTitle)).toBeHidden();

    // Toast "Événement supprimé" with an "Annuler" button
    await expect(page.getByText('Événement supprimé', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).first().click();

    // Event reappears after undo
    await expect(page.getByText(eventTitle)).toBeVisible();
  });
});
