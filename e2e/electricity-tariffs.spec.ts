import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// API helpers (same pattern as electricity-consumption.spec.ts)
// ---------------------------------------------------------------------------

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

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

async function apiCreateTariff(
  page: import('@playwright/test').Page,
  meterId: string,
  payload: {
    valid_from: string;
    price_base?: string | null;
    price_hp?: string | null;
    price_hc?: string | null;
    subscription_eur_month?: string | null;
  },
): Promise<string> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/electricity/meter-tariffs/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      meter: meterId,
      price_base: null,
      price_hp: null,
      price_hc: null,
      subscription_eur_month: null,
      ...payload,
    },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to create tariff: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json() as { id: string };
  return body.id;
}

async function apiCreateReading(
  page: import('@playwright/test').Page,
  meterId: string,
  readingAt: string,
  indexKwh: string,
  register: 'base' | 'hp' | 'hc' = 'base',
): Promise<string> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/electricity/meter-readings/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      meter: meterId,
      reading_at: readingAt,
      index_kwh: indexKwh,
      register,
    },
  });
  if (!resp.ok()) {
    throw new Error(`Failed to create reading: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json() as { id: string };
  return body.id;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Navigates to /app/electricity, creates a board if needed, switches to the
 * Consommation tab, then selects the given meter.
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
 * Opens the "Gérer les tarifs" sheet by clicking the CardActions trigger on the
 * meter bar.
 *
 * The meter bar layout (ConsumptionTab.tsx):
 *   <div class="flex flex-wrap items-center justify-between gap-2">   ← outer
 *     <div class="flex min-w-0 items-center gap-2">                    ← LEFT
 *       <span>{name}</span>  (or <Select aria-label="Choisir un compteur">)
 *       <Badge />                  ← text "Base" or "HP/HC"
 *       <CardActions />            ← icon-only button (no aria-label, no text)
 *     </div>
 *     <div class="flex items-center gap-2">                            ← RIGHT
 *       <Button>Nouveau relevé</Button>
 *       <Button>Importer</Button>
 *     </div>
 *   </div>
 *
 * Strategy: the LEFT inner div contains exactly one icon-only button (CardActions).
 * We can locate it via the meter name span or the select, then navigate to the
 * parent flex container and find its icon-only button sibling.
 *
 * Reliable approach confirmed from the DOM snapshot (error-context.md):
 *   - The LEFT div (e145) contains: combobox | Badge text | button[e149] (no text)
 *   - button[e149] has NO accessible text → use aria-label-less button inside LEFT div
 *
 * We find the LEFT div by locating the "Choisir un compteur" select or the meter
 * name span, going up to their grandparent div, then finding the icon-only button
 * within that container.
 */
async function openTariffsSheet(page: import('@playwright/test').Page): Promise<void> {
  // The CardActions button is the only icon-only (no accessible name) button in the
  // LEFT half of the meter bar. The LEFT container holds either:
  //   - a <select aria-label="Choisir un compteur"> (multi-meter)
  //   - a <span> with the meter name (single meter)
  // In both cases, a <Badge> text node and the icon-only <button> follow.
  //
  // From the DOM snapshot, the LEFT container (e145) is directly inside the outer bar
  // flex div (e144). We navigate: select.ancestor(*[2]) or span.ancestor(*[2]),
  // then find the button inside that container.

  // Try with the select first (multi-meter scenario, most common in tests)
  const meterSelect = page.locator('[aria-label="Choisir un compteur"]');
  const hasSelect = (await meterSelect.count()) > 0;

  let leftContainer;
  if (hasSelect) {
    // The select is inside a wrapper div, then the LEFT container
    leftContainer = meterSelect.locator('xpath=ancestor::*[2]');
  } else {
    // Single meter: the name span is a direct child of the LEFT container
    const meterNameSpan = page.locator('span.truncate').first();
    leftContainer = meterNameSpan.locator('xpath=parent::*');
  }

  // The CardActions trigger is the last button in the left container
  const cardActionsBtn = leftContainer.locator('button').last();
  await cardActionsBtn.click();

  const tariffItem = page.getByRole('menuitem', { name: 'Gérer les tarifs' });
  const menuOpened = await tariffItem.isVisible({ timeout: 3_000 }).catch(() => false);

  if (menuOpened) {
    await tariffItem.click();
  } else {
    await page.keyboard.press('Escape');
    // Should not reach here in normal usage
    expect(menuOpened, 'Failed to open CardActions menu with "Gérer les tarifs"').toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Tarifs du compteur — bandeau coût absent sans tarif', () => {
  test('sans tarif configuré, le bandeau € n\'est pas affiché', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Tariff Absent ${Date.now()}`);

    // Create two readings spanning several days so consumption is estimated
    await apiCreateReading(page, meterId, '2025-06-01T08:00:00Z', '1000');
    await apiCreateReading(page, meterId, '2025-06-15T08:00:00Z', '1150');

    await goToConsumptionWithMeter(page, meterId);

    // Navigate to June 2025 in "Jour" view (period label: "juin 2025")
    // "Mois" granularity shows a full year, "Jour" shows a month — use "Jour"
    // so the period label includes the month name for reliable regex matching.
    await page.getByRole('button', { name: 'Jour', exact: true }).click();

    let attempts = 0;
    while (attempts < 30) {
      const label = await page.locator('span.capitalize').textContent() ?? '';
      if (/juin.*2025/i.test(label)) break;
      await page.getByRole('button', { name: 'Période précédente' }).click();
      attempts++;
    }

    // Wait for the summary to load — kWh total must be visible
    await expect(page.locator('p.text-lg')).toBeVisible({ timeout: 10_000 });

    // The cost banner text keys are "dont conso" and "dont abonnement" — neither
    // should be present when total_cost_eur is null (no tariff).
    await expect(page.getByText(/dont conso/)).not.toBeVisible();
    await expect(page.getByText(/dont abonnement/)).not.toBeVisible();
  });
});

test.describe('Tarifs du compteur — création et bandeau coût', () => {
  test('ajouter un tarif base → le bandeau € apparaît dans la card graphe', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Tariff Create ${Date.now()}`);

    // Two readings with consumption so the API returns a non-zero total_wh
    await apiCreateReading(page, meterId, '2025-07-01T08:00:00Z', '2000');
    await apiCreateReading(page, meterId, '2025-07-15T08:00:00Z', '2150');

    await goToConsumptionWithMeter(page, meterId);

    // Open the TariffsDialog sheet via CardActions
    await openTariffsSheet(page);

    // The sheet renders as a SheetDialog — wait for its title
    await expect(page.getByText(/Tarifs —/)).toBeVisible({ timeout: 8_000 });

    // Click "Nouveau tarif" to open the form view
    await page.getByRole('button', { name: 'Nouveau tarif' }).click();

    // The form view — fill in a date of effect earlier than the readings
    await page.locator('#tariff-valid-from').fill('2025-01-01');
    await page.locator('#tariff-price-base').fill('0.2516');
    await page.locator('#tariff-subscription').fill('12.44');

    // Submit
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    // The form should disappear (back to list view)
    await expect(page.locator('#tariff-valid-from')).not.toBeVisible({ timeout: 8_000 });

    // The newly created tariff must appear in the list
    await expect(page.getByText(/01\/01\/2025|1\/1\/2025/)).toBeVisible({ timeout: 5_000 });

    // Close the sheet using its Close button
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText(/Tarifs —/)).not.toBeVisible({ timeout: 5_000 });

    // Navigate to July 2025 in "Jour" view (period label includes the month name)
    // "Mois" granularity shows a full year; "Jour" shows "juillet 2025" etc.
    await page.getByRole('button', { name: 'Jour', exact: true }).click();

    let attempts = 0;
    while (attempts < 30) {
      const label = await page.locator('span.capitalize').textContent() ?? '';
      if (/juil.*2025/i.test(label)) break;
      await page.getByRole('button', { name: 'Période précédente' }).click();
      attempts++;
    }

    // Wait for the kWh summary to load
    await expect(page.locator('p.text-lg')).toBeVisible({ timeout: 10_000 });

    // The cost banner — "dont conso" — must now be present
    await expect(page.getByText(/dont conso/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('le tarif ajouté est visible dans la liste des tarifs (TariffsDialog)', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Tariff List ${Date.now()}`);
    // Create a tariff directly via API
    await apiCreateTariff(page, meterId, {
      valid_from: '2025-03-01',
      price_base: '0.2400',
      subscription_eur_month: '10.00',
    });

    await goToConsumptionWithMeter(page, meterId);
    await openTariffsSheet(page);

    await expect(page.getByText(/Tarifs —/)).toBeVisible({ timeout: 8_000 });

    // The tariff card must show the date
    await expect(
      page.getByText(/01\/03\/2025|3\/1\/2025|1 mars 2025/i).first(),
    ).toBeVisible({ timeout: 5_000 });

    // The price is displayed in the card
    await expect(page.getByText(/0,24|0\.24/)).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
  });
});

test.describe('Tarifs du compteur — modification d\'un tarif existant', () => {
  test('modifier le prix d\'un tarif → la nouvelle valeur apparaît dans la liste', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Tariff Edit ${Date.now()}`);
    await apiCreateTariff(page, meterId, {
      valid_from: '2025-04-01',
      price_base: '0.2400',
    });

    await goToConsumptionWithMeter(page, meterId);
    await openTariffsSheet(page);

    await expect(page.getByText(/Tarifs —/)).toBeVisible({ timeout: 8_000 });

    // Find the tariff card and click its CardActions → Modifier
    // The tariff card renders a CardActions with Modifier/Supprimer
    const tariffCard = page.getByText(/0,24|0\.24/).locator('xpath=ancestor::*[3]');
    const actionsBtn = tariffCard.locator('button').last();
    await actionsBtn.click();

    await page.getByRole('menuitem', { name: 'Modifier' }).click();

    // Form view opens — change the price
    await expect(page.locator('#tariff-price-base')).toBeVisible({ timeout: 5_000 });
    await page.locator('#tariff-price-base').clear();
    await page.locator('#tariff-price-base').fill('0.2750');

    await page.getByRole('button', { name: 'Enregistrer' }).click();

    // Back to list view — new price visible
    await expect(page.locator('#tariff-price-base')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/0,275|0\.275/).first()).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
  });
});

test.describe('Tarifs du compteur — suppression avec undo', () => {
  test('supprimer un tarif → il disparaît + toast Annuler visible', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Tariff Delete ${Date.now()}`);
    await apiCreateTariff(page, meterId, {
      valid_from: '2025-05-01',
      price_base: '0.2600',
    });

    await goToConsumptionWithMeter(page, meterId);
    await openTariffsSheet(page);

    await expect(page.getByText(/Tarifs —/)).toBeVisible({ timeout: 8_000 });

    // The price text identifies the tariff card
    const priceText = page.getByText(/0,26|0\.26/).first();
    await expect(priceText).toBeVisible({ timeout: 5_000 });

    // Click CardActions on the tariff card → Supprimer
    const tariffCard = priceText.locator('xpath=ancestor::*[3]');
    const actionsBtn = tariffCard.locator('button').last();
    await actionsBtn.click();

    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    // Tariff disappears (optimistic removal)
    await expect(priceText).not.toBeVisible({ timeout: 5_000 });

    // Close the sheet so the undo toast is accessible (the sheet overlay may
    // obscure the toast z-index in the Playwright browser)
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText(/Tarifs —/)).not.toBeVisible({ timeout: 5_000 });

    // Undo toast appears
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 5_000 });
  });

  test('undo de la suppression d\'un tarif → le tarif réapparaît', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Tariff Undo ${Date.now()}`);
    await apiCreateTariff(page, meterId, {
      valid_from: '2025-08-01',
      price_base: '0.2700',
    });

    await goToConsumptionWithMeter(page, meterId);
    await openTariffsSheet(page);

    await expect(page.getByText(/Tarifs —/)).toBeVisible({ timeout: 8_000 });

    const priceText = page.getByText(/0,27|0\.27/).first();
    await expect(priceText).toBeVisible({ timeout: 5_000 });

    const tariffCard = priceText.locator('xpath=ancestor::*[3]');
    const actionsBtn = tariffCard.locator('button').last();
    await actionsBtn.click();

    await page.getByRole('menuitem', { name: 'Supprimer' }).click();
    await expect(priceText).not.toBeVisible({ timeout: 5_000 });

    // Close the sheet before using the undo toast
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText(/Tarifs —/)).not.toBeVisible({ timeout: 5_000 });

    // Click the Undo button on the toast
    const undoBtn = page.getByRole('button', { name: 'Annuler' });
    await expect(undoBtn).toBeVisible({ timeout: 5_000 });
    await undoBtn.click();

    // Re-open the sheet to verify the tariff reappeared
    await openTariffsSheet(page);
    await expect(page.getByText(/Tarifs —/)).toBeVisible({ timeout: 8_000 });
    // The tariff price text must reappear in the list
    await expect(page.getByText(/0,27|0\.27/).first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Tarifs du compteur — abonnement visible dans le bandeau coût', () => {
  test('tarif avec abonnement → "dont abonnement" apparaît dans le bandeau €', async ({ page }) => {
    await page.goto('/app/electricity');

    const meterId = await apiCreateMeter(page, `Tariff Sub ${Date.now()}`);

    // Readings for September 2025
    await apiCreateReading(page, meterId, '2025-09-01T08:00:00Z', '3000');
    await apiCreateReading(page, meterId, '2025-09-30T08:00:00Z', '3120');

    // Tariff effective before the readings, with a subscription
    await apiCreateTariff(page, meterId, {
      valid_from: '2025-01-01',
      price_base: '0.2516',
      subscription_eur_month: '12.44',
    });

    await goToConsumptionWithMeter(page, meterId);

    // Navigate to September 2025 in "Jour" view (period label: "septembre 2025")
    await page.getByRole('button', { name: 'Jour', exact: true }).click();

    let attempts = 0;
    while (attempts < 30) {
      const label = await page.locator('span.capitalize').textContent() ?? '';
      if (/sept.*2025/i.test(label)) break;
      await page.getByRole('button', { name: 'Période précédente' }).click();
      attempts++;
    }

    await expect(page.locator('p.text-lg')).toBeVisible({ timeout: 10_000 });

    // Both cost breakdown items must appear
    await expect(page.getByText(/dont conso/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/dont abonnement/).first()).toBeVisible({ timeout: 10_000 });
  });
});
