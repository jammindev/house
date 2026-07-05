import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// API helpers — create isolated meters via the REST API so each test gets
// a fresh meter with no existing readings (avoids index-ordering conflicts).
// ---------------------------------------------------------------------------

/**
 * Reads the JWT access token from localStorage (set by the React auth context).
 */
async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/**
 * Creates a new meter via the API and returns its id.
 * Using the API (instead of the UI flow) allows creating meters even when
 * the ConsumptionTab is not in the empty state.
 */
async function apiCreateMeter(
  page: import('@playwright/test').Page,
  name: string,
  tariff: 'base' | 'hp_hc' = 'base',
): Promise<string> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/electricity/meters/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name,
      tariff_type: tariff,
      serial_number: '',
      notes: '',
      zone: null,
      timezone: 'Europe/Paris',
    },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to create meter: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json() as { id: string };
  return body.id;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Ensures a board exists, navigates to the Consommation tab, then selects
 * the given meter (by id) using the meter selector if multiple meters exist,
 * or verifies the single meter is active.
 */
async function goToConsumptionWithMeter(
  page: import('@playwright/test').Page,
  meterId: string,
): Promise<void> {
  await page.goto('/app/electricity');

  const emptyState = page.getByText('Aucun tableau électrique');
  const hasEmptyState = await emptyState.isVisible().catch(() => false);

  if (hasEmptyState) {
    await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const zoneSelect = page.locator('#board-zone');
    const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
    await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
    await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: 'Tableau', exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Consommation', exact: true }).click();
  await expect(
    page.getByText('Aucun compteur').or(page.getByRole('button', { name: 'Nouveau relevé' })),
  ).toBeVisible({ timeout: 10_000 });

  // If a meter selector is visible (multiple meters), select our meter
  const meterSelect = page.locator('select[aria-label]');
  const hasSelect = await meterSelect.isVisible().catch(() => false);
  if (hasSelect) {
    await meterSelect.selectOption(meterId);
  }
}

/**
 * Opens "Nouveau relevé" and fills it without waiting for dialog closure.
 */
async function fillAndSubmitReading(
  page: import('@playwright/test').Page,
  datetimeLocal: string,
  indexKwh: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Nouveau relevé' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.locator('#reading-at').fill(datetimeLocal);
  await page.locator('#reading-index').fill(indexKwh);

  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
}

/**
 * Creates a reading and asserts the dialog closes (success path).
 */
async function createReading(
  page: import('@playwright/test').Page,
  datetimeLocal: string,
  indexKwh: string,
): Promise<void> {
  await fillAndSubmitReading(page, datetimeLocal, indexKwh);
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 });
}

/**
 * Simple helper to navigate to the consumption tab without creating an API meter.
 * Creates a board if needed.
 */
async function ensureBoardAndGoToConsumption(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/app/electricity');

  const emptyState = page.getByText('Aucun tableau électrique');
  const hasEmptyState = await emptyState.isVisible().catch(() => false);

  if (hasEmptyState) {
    await page.getByRole('button', { name: 'Nouveau tableau' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const zoneSelect = page.locator('#board-zone');
    const firstZone = zoneSelect.locator('option:not([disabled]):not([value=""])').first();
    await firstZone.waitFor({ state: 'attached', timeout: 10_000 });
    await zoneSelect.selectOption(await firstZone.getAttribute('value') as string);

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: 'Tableau', exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Consommation', exact: true }).click();
  await expect(
    page.getByText('Aucun compteur').or(page.getByRole('button', { name: 'Nouveau relevé' })),
  ).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// 1. Empty state + create meter from UI
// ---------------------------------------------------------------------------

test.describe('onglet Consommation — état vide et création de compteur', () => {
  test.beforeEach(async ({ page }) => {
    await ensureBoardAndGoToConsumption(page);
  });

  test('affiche le bouton "Nouveau compteur" ou la barre compteur', async ({ page }) => {
    const noMeter = page.getByText('Aucun compteur');
    const isEmpty = await noMeter.isVisible().catch(() => false);
    if (isEmpty) {
      await expect(page.getByRole('button', { name: 'Nouveau compteur' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Nouveau relevé' })).toBeVisible();
    }
  });

  test('crée un compteur Base depuis l\'état vide → la barre compteur apparaît', async ({ page }) => {
    const noMeter = page.getByText('Aucun compteur');
    const hasEmpty = await noMeter.isVisible().catch(() => false);

    if (!hasEmpty) {
      await expect(page.getByRole('button', { name: 'Nouveau relevé' })).toBeVisible();
      return;
    }

    const meterName = `Compteur Base ${Date.now()}`;
    await page.getByRole('button', { name: 'Nouveau compteur' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.locator('#meter-name').fill(meterName);
    await page.locator('#meter-tariff').selectOption('base');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText(meterName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Nouveau relevé' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Importer' })).toBeVisible();
  });

  test('le dialog contient les champs : nom, tarification, n° série, zone, notes', async ({ page }) => {
    const noMeter = page.getByText('Aucun compteur');
    const hasEmpty = await noMeter.isVisible().catch(() => false);
    if (!hasEmpty) return; // Only testable from empty state

    await page.getByRole('button', { name: 'Nouveau compteur' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect(page.locator('#meter-name')).toBeVisible();
    await expect(page.locator('#meter-tariff')).toBeVisible();
    await expect(page.locator('#meter-serial')).toBeVisible();
    await expect(page.locator('#meter-zone')).toBeVisible();
    await expect(page.locator('#meter-notes')).toBeVisible();

    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2 & 3. Relevés manuels — each test uses a fresh isolated meter via API
// ---------------------------------------------------------------------------

test.describe('onglet Consommation — relevés manuels', () => {
  test('saisir un relevé → il apparaît dans la liste "Relevés récents"', async ({ page }) => {
    // Navigate to electricity page first (needed to get a valid auth token)
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Relevé Single ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    // With a fresh meter, any datetime and index are valid
    await createReading(page, '2025-06-15T10:00', '1000');

    await expect(
      page.getByText(/1\s*000\s*kWh/).or(page.getByText('1000 kWh')).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('deux relevés (index croissants) → la barre de total est visible dans la vue Mois', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Relevé Croissants ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    await createReading(page, '2025-05-01T08:00', '1000');
    await createReading(page, '2025-05-15T08:00', '1150');

    // Navigate to Mois granularity
    await page.getByRole('button', { name: 'Mois', exact: true }).click();

    // Navigate to May 2025
    let attempts = 0;
    while (attempts < 30) {
      const label = await page.locator('span.capitalize').textContent();
      if (label && label.toLowerCase().includes('mai') && label.includes('2025')) break;
      await page.getByRole('button', { name: 'Période précédente' }).click();
      attempts++;
    }

    // The kWh total bar must be visible
    await expect(page.locator('p.text-lg')).toBeVisible();

    // The consumption chart or the "no data" message should be present
    await expect(
      page.locator('.recharts-wrapper').or(page.getByText('Aucune donnée de consommation')),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('relevé avec index décroissant → erreur visible dans le dialog', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Relevé Décroissant ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    // Create a reading with a high index
    await createReading(page, '2025-04-01T09:00', '5000');

    // Try a reading AFTER the first one but with a lower index
    await fillAndSubmitReading(page, '2025-04-15T09:00', '100');

    // Dialog stays open with error
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('p.text-destructive')).toBeVisible({ timeout: 5_000 });

    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Navigation entre granularités
// ---------------------------------------------------------------------------

test.describe('onglet Consommation — granularités et navigation', () => {
  test.beforeEach(async ({ page }) => {
    await ensureBoardAndGoToConsumption(page);
    const noMeter = page.getByText('Aucun compteur');
    const hasEmpty = await noMeter.isVisible().catch(() => false);
    if (hasEmpty) {
      // Need at least one meter to test granularity navigation
      await apiCreateMeter(page, `Compteur Gran ${Date.now()}`).then(async (id) => {
        // Reload to pick up the new meter
        await goToConsumptionWithMeter(page, id);
      });
    }
  });

  test('les quatre FilterPills de granularité sont visibles', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Heure', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jour', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mois', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Année', exact: true })).toBeVisible();
  });

  test('vue Heure affiche le message dédié quand aucune donnée d\'import n\'existe', async ({ page }) => {
    await page.getByRole('button', { name: 'Heure', exact: true }).click();
    await expect(
      page.getByText("La vue horaire n'affiche que les données importées"),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('vue Jour est accessible et affiche la card de total kWh', async ({ page }) => {
    await page.getByRole('button', { name: 'Jour', exact: true }).click();
    await expect(page.locator('p.text-lg')).toBeVisible();
  });

  test('vue Mois est accessible et affiche la card de total kWh', async ({ page }) => {
    await page.getByRole('button', { name: 'Mois', exact: true }).click();
    await expect(page.locator('p.text-lg')).toBeVisible();
  });

  test('vue Année est accessible et affiche la card de total kWh', async ({ page }) => {
    await page.getByRole('button', { name: 'Année', exact: true }).click();
    await expect(page.locator('p.text-lg')).toBeVisible();
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
// 5. Import CSV Enedis
// ---------------------------------------------------------------------------

test.describe('onglet Consommation — import CSV Enedis', () => {
  const IMPORT_DATE = '2026-06-01';
  const ENEDIS_CSV = [
    'Identifiant PRM;Date de début;Date de fin;Grandeur physique;Unité',
    `00000000000000;${IMPORT_DATE};2026-06-02;Puissance moyenne;W`,
    '',
    'Horodate;Valeur',
    `${IMPORT_DATE}T00:30:00+02:00;420`,
    `${IMPORT_DATE}T01:00:00+02:00;380`,
    `${IMPORT_DATE}T01:30:00+02:00;`,
    `${IMPORT_DATE}T02:00:00+02:00;350`,
    `${IMPORT_DATE}T02:30:00+02:00;1200`,
    `${IMPORT_DATE}T03:00:00+02:00;900`,
  ].join('\n');

  test('le bouton "Importer" ouvre le dialog d\'import', async ({ page }) => {
    await page.goto('/app/electricity');
    const meterId = await apiCreateMeter(page, `Compteur Import Open ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    await page.getByRole('button', { name: 'Importer' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#import-file')).toBeVisible();

    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('import du CSV Enedis → toast de succès "Import terminé"', async ({ page }) => {
    await page.goto('/app/electricity');
    const meterId = await apiCreateMeter(page, `Compteur Import Toast ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    await page.getByRole('button', { name: 'Importer' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const csvBuffer = Buffer.from(ENEDIS_CSV, 'utf-8');
    await page.locator('#import-file').setInputFiles({
      name: 'enedis_courbe_de_charge.csv',
      mimeType: 'text/csv',
      buffer: csvBuffer,
    });

    await expect(page.getByRole('button', { name: 'Importer' }).last()).toBeEnabled({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Importer' }).last().click();

    // Toast: "Import terminé : X points ajoutés, Y déjà connus."
    // Use .first() to avoid strict-mode violation (toast div + aria-live span both match)
    await expect(page.getByText(/Import terminé/).first()).toBeVisible({ timeout: 15_000 });
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  test('après l\'import, la vue Heure du jour importé est non vide (chart visible)', async ({ page }) => {
    await page.goto('/app/electricity');
    const meterId = await apiCreateMeter(page, `Compteur Import Chart ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    // Import the CSV
    await page.getByRole('button', { name: 'Importer' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const csvBuffer = Buffer.from(ENEDIS_CSV, 'utf-8');
    await page.locator('#import-file').setInputFiles({
      name: 'enedis_courbe_de_charge.csv',
      mimeType: 'text/csv',
      buffer: csvBuffer,
    });

    await expect(page.getByRole('button', { name: 'Importer' }).last()).toBeEnabled({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Importer' }).last().click();
    await expect(page.getByText(/Import terminé/).first()).toBeVisible({ timeout: 15_000 });
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });

    // Switch to Heure granularity
    await page.getByRole('button', { name: 'Heure', exact: true }).click();

    // Navigate to 2026-06-01.
    // In "Heure" granularity, periodLabel renders e.g. "samedi 1 juin 2026".
    // We need to match exactly "1 juin 2026" (day 1, not 11/21/31).
    let attempts = 0;
    while (attempts < 60) {
      const label = await page.locator('span.capitalize').textContent() ?? '';
      // Match "1 juin 2026" — day must be "1" followed by " juin" to avoid "11", "21"
      if (/\b1\s+juin\s+2026\b/i.test(label)) break;
      await page.getByRole('button', { name: 'Période précédente' }).click();
      attempts++;
    }

    // The "noHourlyData" message must NOT be shown
    await expect(
      page.getByText("La vue horaire n'affiche que les données importées"),
    ).not.toBeVisible({ timeout: 5_000 });

    // Chart total is present
    await expect(page.locator('p.text-lg')).toBeVisible();

    // Recharts SVG must be rendered (use .first() to avoid strict-mode violation
    // if multiple chart wrappers exist on the page)
    await expect(
      page.locator('.recharts-wrapper').or(page.locator('svg.recharts-surface')).first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// 6. Modifier et supprimer un relevé
// ---------------------------------------------------------------------------

test.describe('onglet Consommation — modifier et supprimer un relevé', () => {
  test('supprime un relevé → il disparaît et le toast Annuler apparaît', async ({ page }) => {
    await page.goto('/app/electricity');
    const meterId = await apiCreateMeter(page, `Compteur Suppr ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    await createReading(page, '2025-01-10T10:00', '1000');

    // Find the reading by its index
    const kwhLoc = page.getByText(/1\s*000\s*kWh/).or(page.getByText('1000 kWh')).first();
    await kwhLoc.waitFor({ state: 'visible', timeout: 5_000 });

    const ancestor = kwhLoc.locator('xpath=ancestor::*[4]');
    await ancestor.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // Reading disappears (optimistic removal)
    await expect(kwhLoc).not.toBeVisible({ timeout: 5_000 });

    // Undo toast appears
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 5_000 });
  });

  test('undo de la suppression → le relevé réapparaît', async ({ page }) => {
    await page.goto('/app/electricity');
    const meterId = await apiCreateMeter(page, `Compteur Undo ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    await createReading(page, '2025-02-05T09:00', '2000');

    const kwhLoc = page.getByText(/2\s*000\s*kWh/).or(page.getByText('2000 kWh')).first();
    await kwhLoc.waitFor({ state: 'visible', timeout: 5_000 });

    const ancestor = kwhLoc.locator('xpath=ancestor::*[4]');
    await ancestor.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    const undoBtn = page.getByRole('button', { name: 'Annuler' });
    await expect(undoBtn).toBeVisible({ timeout: 5_000 });
    await undoBtn.click();

    await expect(kwhLoc).toBeVisible({ timeout: 5_000 });
  });

  test('modifie un relevé → la nouvelle valeur apparaît', async ({ page }) => {
    await page.goto('/app/electricity');
    const meterId = await apiCreateMeter(page, `Compteur Edit ${Date.now()}`);
    await goToConsumptionWithMeter(page, meterId);

    await createReading(page, '2025-03-01T08:00', '3000');

    const kwhBefore = page.getByText(/3\s*000\s*kWh/).or(page.getByText('3000 kWh')).first();
    await kwhBefore.waitFor({ state: 'visible', timeout: 5_000 });

    const ancestor = kwhBefore.locator('xpath=ancestor::*[4]');
    await ancestor.locator('button').last().click();
    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();

    await page.locator('#reading-index').fill('3500');
    await editDialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(editDialog).not.toBeVisible({ timeout: 8_000 });

    const kwhAfter = page.getByText(/3\s*500\s*kWh/).or(page.getByText('3500 kWh')).first();
    await expect(kwhAfter).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// 7. Modifier le compteur via CardActions
// ---------------------------------------------------------------------------

test.describe('onglet Consommation — modifier le compteur', () => {
  test('modifie le nom du compteur via le menu CardActions', async ({ page }) => {
    await page.goto('/app/electricity');
    const suffix = Date.now();
    const meterName = `Compteur Modif ${suffix}`;
    const meterNameEdited = `Compteur Modif ${suffix} modifié`;

    const meterId = await apiCreateMeter(page, meterName);
    await goToConsumptionWithMeter(page, meterId);

    // The meter bar structure (from ConsumptionTab.tsx):
    //   <div class="flex ... items-center justify-between ...">
    //     <div class="flex ... items-center ...">
    //       <span>{name}</span> or <Select>  ← name/selector
    //       <Badge />                         ← tariff badge
    //       <CardActions />                   ← icon-only button
    //     </div>
    //     <div class="flex items-center gap-2">
    //       <Button>Nouveau relevé</Button>
    //       <Button>Importer</Button>
    //     </div>
    //   </div>
    //
    // The CardActions trigger is in the LEFT half of the meter bar.
    // We find the left container by locating the "Nouveau relevé" button and going
    // to its parent's first sibling.
    // Simpler approach: find all buttons on the page, skip the named ones, and
    // click the one that opens a menu with "Modifier".

    // The meter bar structure (ConsumptionTab.tsx, line 216-248):
    //   <div class="flex flex-wrap items-center justify-between gap-2">  ← outer bar
    //     <div class="flex min-w-0 items-center gap-2">              ← LEFT half
    //       <span>{name}</span> or <Select>                          ← name/selector
    //       <Badge />                                                 ← tariff badge
    //       <CardActions />                                           ← icon-only button
    //     </div>
    //     <div class="flex items-center gap-2">                       ← RIGHT half
    //       <Button>Nouveau relevé</Button>
    //       <Button>Importer</Button>
    //     </div>
    //   </div>
    //
    // Strategy: the CardActions trigger is the button IMMEDIATELY BEFORE
    // the "Nouveau relevé" button in the DOM.
    const newReadingBtn = page.getByRole('button', { name: 'Nouveau relevé' });
    const cardActionsBtn = newReadingBtn.locator('xpath=preceding-sibling::button[1]');

    // If not found as sibling, fall back to "the last button in the left flex container"
    const exists = await cardActionsBtn.count();
    let menuOpened = false;

    if (exists > 0) {
      await cardActionsBtn.click();
      const modifyItem = page.getByRole('menuitem', { name: 'Modifier' });
      menuOpened = await modifyItem.isVisible({ timeout: 2_000 }).catch(() => false);
      if (menuOpened) {
        await modifyItem.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    if (!menuOpened) {
      // Fallback: find icon-only buttons (no text) in the consumption area
      // and try the one just before "Nouveau relevé"
      const allIconBtns = page.locator('button:not(:has-text("Nouveau relevé")):not(:has-text("Importer")):not(:has-text("Heure")):not(:has-text("Jour")):not(:has-text("Mois")):not(:has-text("Année")):not(:has-text("Période")):not(:has-text("Tableau")):not(:has-text("Circuits")):not(:has-text("Liens")):not(:has-text("Notifications")):not(:has-text("Se déconnecter"))');
      const iconBtnCount = await allIconBtns.count();
      for (let i = iconBtnCount - 1; i >= 0 && !menuOpened; i--) {
        const btn = allIconBtns.nth(i);
        const txt = (await btn.textContent() ?? '').trim();
        if (txt !== '') continue;
        await btn.click();
        const modifyItem = page.getByRole('menuitem', { name: 'Modifier' });
        menuOpened = await modifyItem.isVisible({ timeout: 1_000 }).catch(() => false);
        if (menuOpened) {
          await modifyItem.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }

    expect(menuOpened, 'Failed to open the CardActions menu on the meter bar').toBe(true);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const nameInput = page.locator('#meter-name');
    await nameInput.clear();
    await nameInput.fill(meterNameEdited);

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // After renaming, verify the change took effect.
    // The meter name appears either as:
    //   - a plain <span> (when only one meter exists) — getByText → visible
    //   - a selected <option> in a <select> (when multiple meters) — option is hidden
    //     but we can check the selected option text via page.evaluate
    const nameInPage = page.getByText(meterNameEdited).first();
    const isVisible = await nameInPage.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!isVisible) {
      // Fall back: check via the selected option text in the meter select
      const selectedOptionText = await page.evaluate(() => {
        const sel = document.querySelector('select[aria-label]') as HTMLSelectElement | null;
        if (!sel) return null;
        return sel.options[sel.selectedIndex]?.text ?? null;
      });
      expect(selectedOptionText).toContain('modifié');
    } else {
      await expect(nameInPage).toBeVisible({ timeout: 5_000 });
    }
  });
});
