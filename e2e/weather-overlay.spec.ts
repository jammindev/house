/**
 * E2E — Température en overlay sur les graphes de consommation (parcours 17, Lot 6)
 *
 * Three stubs are combined so tests are fully deterministic — no live
 * Open-Meteo call, no real water readings required:
 *
 *  1. /api/households/   — injects lat/lon on the demo household so the
 *     overlay is "available" (useTemperatureOverlay checks household?.latitude).
 *  2. /api/water/consumption/summary/  — returns a couple of day buckets
 *     so the ConsumptionBarChart renders (overlay is only injected when there
 *     are buckets).
 *  3. /api/weather/history/  — returns temperature points aligned to the
 *     stubbed consumption buckets.
 *
 * Auth is handled by storageState in playwright.config.ts — no inline login.
 *
 * NOTE on readings: WaterPage renders the chart view only when readings.length
 * > 0.  Rather than deleting/creating real readings we stub
 * /api/water/readings/ too so the page always sees exactly one reading
 * (enough to skip the EmptyState and reach the chart).
 */

import { test, expect } from './fixtures';
import type { Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ISO dates used for consumption + history stubs (far enough in the past so
// the "day" period that the page defaults to can navigate to them; for the
// "day" granularity we stub the current day instead to avoid navigation).
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

// Two stubbed consumption buckets: yesterday + today (day granularity).
const CONSUMPTION_BUCKETS = [
  { ts: YESTERDAY, total_l: 120_000 }, // 120 m³
  { ts: TODAY, total_l: 80_000 },      // 80 m³
];

// Temperature points that match the above buckets.
const WEATHER_HISTORY_POINTS = [
  { date: YESTERDAY, temp_mean: 14.2 },
  { date: TODAY, temp_mean: 17.5 },
];

// A minimal household payload that includes lat/lon so the overlay is available.
// Only the fields the frontend reads are populated.
const HOUSEHOLD_WITH_LOCATION = {
  id: 'demo-household',
  name: 'Mercier',
  created_at: '2024-01-01T00:00:00Z',
  address: '',
  city: 'Paris',
  postal_code: '',
  country: 'FR',
  timezone: 'Europe/Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  location_label: 'Paris, Île-de-France, France',
  context_notes: '',
  ai_prompt_context: '',
  inbound_email_alias: null,
  disabled_modules: [],           // weather module is enabled
  default_household: true,
  members_count: 3,
  current_user_role: 'owner',
  archived_at: null,
};

const HOUSEHOLD_WITHOUT_LOCATION = {
  ...HOUSEHOLD_WITH_LOCATION,
  latitude: null,
  longitude: null,
  location_label: '',
};

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------

/**
 * Stubs GET /api/households/ to return a household with a location set.
 * Individual PATCH/POST requests are passed through unchanged.
 */
async function stubHouseholdWithLocation(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.route('**/api/households/**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    // The list endpoint returns an array; detail endpoint returns an object.
    // Both are used by the app. We return a list (modules.ts uses index 0).
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([HOUSEHOLD_WITH_LOCATION]),
    });
  });
}

/**
 * Stubs GET /api/households/ to return a household WITHOUT lat/lon.
 */
async function stubHouseholdWithoutLocation(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.route('**/api/households/**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([HOUSEHOLD_WITHOUT_LOCATION]),
    });
  });
}

/**
 * Stubs GET /api/water/readings/ so the page always sees one reading and
 * skips the EmptyState (which hides the chart + granularity pills).
 */
async function stubWaterReadings(
  page: import('@playwright/test').Page,
): Promise<void> {
  const reading = {
    id: 'stub-reading-1',
    household: 'demo-household',
    reading_date: YESTERDAY,
    index_m3: '1250.500',
    created_at: `${YESTERDAY}T10:00:00Z`,
    updated_at: `${YESTERDAY}T10:00:00Z`,
  };
  await page.route('**/api/water/readings/**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([reading]),
    });
  });
}

/**
 * Stubs GET /api/water/consumption/summary/ to return two day-buckets.
 * Uses the "day" granularity buckets (TODAY and YESTERDAY) so the chart
 * renders in the default "Jour" view.
 */
async function stubWaterConsumptionSummary(
  page: import('@playwright/test').Page,
): Promise<void> {
  const payload = {
    granularity: 'day',
    date_from: YESTERDAY,
    date_to: TODAY,
    total_l: 200_000,
    buckets: CONSUMPTION_BUCKETS,
  };
  await page.route('**/api/water/consumption/summary/**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

/**
 * Stubs GET /api/weather/history/ with temperature points aligned to the
 * consumption buckets.
 */
async function stubWeatherHistory(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.route('**/api/weather/history/**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: true,
        points: WEATHER_HISTORY_POINTS,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// 1. Eau — toggle Météo visible avec foyer localisé
// ---------------------------------------------------------------------------

test.describe('Eau — overlay météo disponible (foyer avec localisation)', () => {
  test.beforeEach(async ({ page }) => {
    await stubHouseholdWithLocation(page);
    await stubWaterReadings(page);
    await stubWaterConsumptionSummary(page);
    await page.goto('/app/water');
    // Wait for chart area to load (granularity pills appear after readings load)
    await expect(page.getByRole('button', { name: 'Jour', exact: true })).toBeVisible();
  });

  test('le toggle "Météo" est visible à côté des granularités', async ({ page }) => {
    // WeatherOverlayToggle renders a FilterPill with t('weather.overlay.toggle') = "Météo"
    // It appears only when: weather module enabled + lat/lon set + granularity day|month
    const toggle = page.getByRole('button', { name: 'Météo', exact: true });
    await expect(toggle).toBeVisible();
  });

  test('activer le toggle déclenche un appel GET /api/weather/history/', async ({ page }) => {
    await stubWeatherHistory(page);

    // Track the weather history request
    const historyRequestPromise = page.waitForRequest('**/api/weather/history/**');

    const toggle = page.getByRole('button', { name: 'Météo', exact: true });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // The history endpoint must have been called after toggling on
    const historyRequest = await historyRequestPromise;
    expect(historyRequest.url()).toContain('/api/weather/history/');
  });

  test('activer le toggle fait apparaître la légende "Température" dans le graphe', async ({ page }) => {
    await stubWeatherHistory(page);

    const toggle = page.getByRole('button', { name: 'Météo', exact: true });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // recharts Legend renders overlay.label = t('weather.overlay.temperature') = "Température"
    // The Legend component renders text inside the chart wrapper. Wait for it to appear.
    await expect(page.locator('main').getByText('Température')).toBeVisible({ timeout: 8_000 });
  });

  test('activer le toggle fait apparaître une ligne SVG dans le graphe (Line recharts)', async ({ page }) => {
    await stubWeatherHistory(page);

    const toggle = page.getByRole('button', { name: 'Météo', exact: true });
    await toggle.click();

    // recharts renders a <g class="recharts-layer recharts-line"> for the overlay Line
    await expect(page.locator('.recharts-line').first()).toBeVisible({ timeout: 8_000 });
  });

  test('le toggle Météo est absent en vue Année (granularité non supportée)', async ({ page }) => {
    await page.getByRole('button', { name: 'Année', exact: true }).click();

    // overlay.ts: OVERLAY_GRANULARITIES = ['day', 'month'] → 'year' is not in it
    // WeatherOverlayToggle is conditionally rendered only when available=true
    const toggle = page.getByRole('button', { name: 'Météo', exact: true });
    await expect(toggle).toHaveCount(0);
  });

  test('le toggle Météo est visible en vue Mois', async ({ page }) => {
    await page.getByRole('button', { name: 'Mois', exact: true }).click();
    const toggle = page.getByRole('button', { name: 'Météo', exact: true });
    await expect(toggle).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Eau — toggle Météo absent sans localisation
// ---------------------------------------------------------------------------

test.describe('Eau — overlay météo indisponible (foyer sans localisation)', () => {
  test('le toggle "Météo" est absent quand le foyer n\'a pas de lat/lon', async ({ page }) => {
    await stubHouseholdWithoutLocation(page);
    await stubWaterReadings(page);
    await stubWaterConsumptionSummary(page);
    await page.goto('/app/water');

    // Wait for page to be ready (granularity pills load after readings)
    await expect(page.getByRole('button', { name: 'Jour', exact: true })).toBeVisible();

    // useTemperatureOverlay: available = configured && supported
    // configured = !disabled.has('weather') && lat != null && lon != null → false here
    const toggle = page.getByRole('button', { name: 'Météo', exact: true });
    await expect(toggle).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Électricité — smoke test du toggle Météo sur l'onglet Consommation
// ---------------------------------------------------------------------------

test.describe('Électricité — overlay météo (smoke, onglet Consommation)', () => {
  test('le toggle "Météo" est visible en vue Jour sur l\'onglet Consommation', async ({ page }) => {
    // Stub the household to provide a location
    await stubHouseholdWithLocation(page);

    // Stub electricity consumption summary for the "day" granularity
    const elecPayload = {
      granularity: 'day',
      date_from: YESTERDAY,
      date_to: TODAY,
      total_kwh: 12.5,
      buckets: [
        { ts: YESTERDAY, total_kwh: 7.0, by_tariff: {} },
        { ts: TODAY, total_kwh: 5.5, by_tariff: {} },
      ],
    };
    await page.route('**/api/electricity/consumption/summary/**', async (route: Route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(elecPayload),
      });
    });

    await page.goto('/app/electricity');

    // If there's an empty state ("Aucun tableau électrique"), create a board first
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

    // Navigate to Consommation tab
    await page.getByRole('button', { name: 'Consommation', exact: true }).click();
    // Wait for the tab to load (either empty state or granularity pills appear)
    await expect(
      page.getByText('Aucun compteur').or(page.getByRole('button', { name: 'Nouveau relevé' })),
    ).toBeVisible({ timeout: 10_000 });

    // If no meter exists, the ConsumptionTab renders an empty state without granularity pills
    const noMeter = page.getByText('Aucun compteur');
    const hasNoMeter = await noMeter.isVisible().catch(() => false);
    if (hasNoMeter) {
      // Cannot test the overlay without a meter — skip gracefully
      // (this happens when the E2E DB is completely empty for electricity)
      return;
    }

    // Switch to Jour granularity (default might already be Jour, but be explicit)
    const jourButton = page.getByRole('button', { name: 'Jour', exact: true });
    await expect(jourButton).toBeVisible({ timeout: 8_000 });
    await jourButton.click();

    // The Météo toggle should now be visible (household has lat/lon, granularity is day)
    const toggle = page.getByRole('button', { name: 'Météo', exact: true });
    await expect(toggle).toBeVisible({ timeout: 8_000 });
  });
});
