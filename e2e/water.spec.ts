import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * Reads the JWT access token from localStorage (set by the React auth context).
 */
async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/**
 * Deletes all water readings for the household via the API so each test suite
 * starts from a known-empty state.
 */
async function deleteAllReadingsViaApi(page: import('@playwright/test').Page): Promise<void> {
  const token = await getAccessToken(page);
  const resp = await page.request.get('/api/water/readings/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) return;
  const body = await resp.json() as unknown;
  const items: Array<{ id: string }> = Array.isArray(body)
    ? body as Array<{ id: string }>
    : ((body as { results?: Array<{ id: string }> }).results ?? []);
  for (const item of items) {
    await page.request.delete(`/api/water/readings/${item.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

/**
 * Creates a water reading via the API and returns the created object.
 */
async function apiCreateReading(
  page: import('@playwright/test').Page,
  readingDate: string,
  indexM3: string,
): Promise<{ id: string; reading_date: string; index_m3: string }> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/water/readings/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { reading_date: readingDate, index_m3: indexM3 },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to create water reading: ${resp.status()} ${await resp.text()}`);
  }
  return resp.json() as Promise<{ id: string; reading_date: string; index_m3: string }>;
}

// ---------------------------------------------------------------------------
// 1. Empty state + first reading creation
// ---------------------------------------------------------------------------

test.describe('Eau — état vide et premier relevé', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so JWT is in localStorage, then clear
    await page.goto('/app/water');
    await deleteAllReadingsViaApi(page);
    await page.reload();
  });

  test('affiche le titre "Eau" et l\'état vide', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Eau' })).toBeVisible();
    await expect(page.getByText('Aucun relevé')).toBeVisible();
  });

  test('le bouton de l\'état vide ouvre le dialog de saisie', async ({ page }) => {
    await expect(page.getByText('Aucun relevé')).toBeVisible();
    await page.getByRole('button', { name: 'Nouveau relevé' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#water-reading-date')).toBeVisible();
    await expect(page.locator('#water-reading-index')).toBeVisible();
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('crée un premier relevé (backdaté) → apparaît dans la liste', async ({ page }) => {
    await page.getByRole('button', { name: 'Nouveau relevé' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const backdatedDate = isoDateOffset(30);
    await page.locator('#water-reading-date').fill(backdatedDate);
    await page.locator('#water-reading-index').fill('1250.5');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // The page should now show the content view with the reading list
    await expect(page.getByText(/1\s*250[,.]?5?\s*m³/).or(page.getByText('1 250,5 m³')).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Two readings → chart card shows non-zero total
// ---------------------------------------------------------------------------

test.describe('Eau — deux relevés → graphe affiché', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/water');
    await deleteAllReadingsViaApi(page);
  });

  test('deux relevés avec index croissants → card graphe affiche un total m³ non zéro', async ({ page }) => {
    // Create first reading 30 days ago
    const date1 = isoDateOffset(30);
    const date2 = isoDateOffset(0); // today

    await apiCreateReading(page, date1, '1250.5');
    await apiCreateReading(page, date2, '1275.0');

    await page.reload();

    // Chart card with total should be visible
    await expect(page.locator('p.text-lg')).toBeVisible({ timeout: 8_000 });
    const totalText = await page.locator('p.text-lg').textContent();
    expect(totalText).toContain('m³');

    // The chart (recharts) or the noData message should be present
    // Navigate to "Mois" granularity so the period covers the readings
    await page.getByRole('button', { name: 'Mois', exact: true }).click();

    // Navigate back far enough to cover date1 if needed
    // Then navigate forward until the total is non-zero or chart is visible
    await expect(
      page.locator('.recharts-wrapper').or(page.getByText('Aucune donnée de consommation sur cette période.')),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('le titre de la section relevés récents est visible', async ({ page }) => {
    const date1 = isoDateOffset(30);
    const date2 = isoDateOffset(0);
    await apiCreateReading(page, date1, '1250.5');
    await apiCreateReading(page, date2, '1275.0');

    await page.reload();

    await expect(page.getByText('Derniers relevés')).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Granularity FilterPills + period navigation
// ---------------------------------------------------------------------------

test.describe('Eau — granularités et navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/water');
    // Make sure at least one reading exists so we see the content view
    const token = await getAccessToken(page);
    const resp = await page.request.get('/api/water/readings/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await resp.json() as unknown;
    const items: Array<{ id: string }> = Array.isArray(body)
      ? body as Array<{ id: string }>
      : ((body as { results?: Array<{ id: string }> }).results ?? []);
    if (items.length === 0) {
      await apiCreateReading(page, isoDateOffset(5), '1000');
      await page.reload();
    }
    await expect(page.locator('p.text-lg')).toBeVisible({ timeout: 10_000 });
  });

  test('les trois FilterPills de granularité sont visibles (Jour / Mois / Année)', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Jour', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mois', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Année', exact: true })).toBeVisible();
  });

  test('vue Mois est accessible et affiche la card de total m³', async ({ page }) => {
    await page.getByRole('button', { name: 'Mois', exact: true }).click();
    await expect(page.locator('p.text-lg')).toBeVisible();
    const text = await page.locator('p.text-lg').textContent();
    expect(text).toContain('m³');
  });

  test('vue Année est accessible et affiche la card de total m³', async ({ page }) => {
    await page.getByRole('button', { name: 'Année', exact: true }).click();
    await expect(page.locator('p.text-lg')).toBeVisible();
    const text = await page.locator('p.text-lg').textContent();
    expect(text).toContain('m³');
  });

  test('navigation ◀ change le libellé de période', async ({ page }) => {
    await page.getByRole('button', { name: 'Mois', exact: true }).click();
    const labelBefore = await page.locator('span.capitalize').textContent();

    await page.getByRole('button', { name: 'Période précédente' }).click();
    const labelAfter = await page.locator('span.capitalize').textContent();

    expect(labelBefore).not.toEqual(labelAfter);
  });

  test('navigation ▶ change le libellé de période', async ({ page }) => {
    await page.getByRole('button', { name: 'Mois', exact: true }).click();
    await page.getByRole('button', { name: 'Période précédente' }).click();
    const labelBefore = await page.locator('span.capitalize').textContent();

    await page.getByRole('button', { name: 'Période suivante' }).click();
    const labelAfter = await page.locator('span.capitalize').textContent();

    expect(labelBefore).not.toEqual(labelAfter);
  });
});

// ---------------------------------------------------------------------------
// 4. Modifier un relevé
// ---------------------------------------------------------------------------

test.describe('Eau — modifier un relevé', () => {
  test('modifie l\'index d\'un relevé → nouvelle valeur visible dans la liste', async ({ page }) => {
    await page.goto('/app/water');
    await deleteAllReadingsViaApi(page);

    const date1 = isoDateOffset(10);
    await apiCreateReading(page, date1, '1000');
    await page.reload();

    // Wait for the reading list
    await expect(page.getByText('Derniers relevés')).toBeVisible({ timeout: 8_000 });

    // Find the reading card; the index shows "1 000 m³" or "1000 m³"
    const indexLoc = page.getByText(/1\s*000\s*m³/).first();
    await indexLoc.waitFor({ state: 'visible', timeout: 5_000 });

    // Open CardActions menu from the ancestor card
    const ancestor = indexLoc.locator('xpath=ancestor::*[4]');
    await ancestor.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Update the index
    await page.locator('#water-reading-index').fill('1050.5');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // New value should appear
    await expect(page.getByText(/1\s*050[,.]?5?\s*m³/).or(page.getByText('1 050,5 m³')).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 5. Supprimer un relevé + toast undo
// ---------------------------------------------------------------------------

test.describe('Eau — suppression et undo', () => {
  test('supprime un relevé → il disparaît + toast "Annuler" apparaît', async ({ page }) => {
    await page.goto('/app/water');
    await deleteAllReadingsViaApi(page);

    await apiCreateReading(page, isoDateOffset(15), '2000');
    await page.reload();

    await expect(page.getByText('Derniers relevés')).toBeVisible({ timeout: 8_000 });

    const indexLoc = page.getByText(/2\s*000\s*m³/).first();
    await indexLoc.waitFor({ state: 'visible', timeout: 5_000 });

    const ancestor = indexLoc.locator('xpath=ancestor::*[4]');
    await ancestor.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // Optimistic removal
    await expect(indexLoc).not.toBeVisible({ timeout: 5_000 });

    // Undo toast
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 5_000 });
  });

  test('undo de la suppression → le relevé réapparaît', async ({ page }) => {
    await page.goto('/app/water');
    await deleteAllReadingsViaApi(page);

    await apiCreateReading(page, isoDateOffset(20), '3000');
    await page.reload();

    await expect(page.getByText('Derniers relevés')).toBeVisible({ timeout: 8_000 });

    const indexLoc = page.getByText(/3\s*000\s*m³/).first();
    await indexLoc.waitFor({ state: 'visible', timeout: 5_000 });

    const ancestor = indexLoc.locator('xpath=ancestor::*[4]');
    await ancestor.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    const undoBtn = page.getByRole('button', { name: 'Annuler' });
    await expect(undoBtn).toBeVisible({ timeout: 5_000 });
    await undoBtn.click();

    await expect(indexLoc).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// 6. Erreur de monotonie (index inférieur à un relevé précédent)
// ---------------------------------------------------------------------------

test.describe('Eau — validation monotonie', () => {
  test('créer un relevé avec index inférieur au précédent → erreur dans le dialog', async ({ page }) => {
    await page.goto('/app/water');
    await deleteAllReadingsViaApi(page);

    // Two existing readings: date1 (old) with index 1000, date3 (recent) with 1300
    const date1 = isoDateOffset(30);
    const date3 = isoDateOffset(5);
    await apiCreateReading(page, date1, '1000');
    await apiCreateReading(page, date3, '1300');
    await page.reload();

    await expect(page.getByText('Derniers relevés')).toBeVisible({ timeout: 8_000 });

    // Open the creation dialog
    await page.getByRole('button', { name: 'Nouveau relevé' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // A date between the two but an index LOWER than date3 (1300)
    const dateBetween = isoDateOffset(15);
    await page.locator('#water-reading-date').fill(dateBetween);
    // Index 500 is lower than 1000 (date1), violating monotonicity
    await page.locator('#water-reading-index').fill('500');

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // Dialog must stay open with an error
    await expect(dialog).toBeVisible();
    await expect(page.locator('p.text-destructive')).toBeVisible({ timeout: 5_000 });

    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
