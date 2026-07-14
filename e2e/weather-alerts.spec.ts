/**
 * E2E — Alertes météo (parcours 17, Lot 4)
 *
 * The `/api/alerts/summary/` endpoint is stubbed via page.route so tests are
 * fully deterministic — no real weather data or household location required.
 *
 * Tested: AlertsPage section "Météo", severity badge, empty-state when no
 * alerts, and the dashboard TriageSection when weather alerts are present.
 *
 * Auth is handled by storageState in playwright.config.ts — no inline login.
 */

import { test, expect } from './fixtures';
import type { Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Alert summary stub factory
// ---------------------------------------------------------------------------

interface AlertsSummaryOverride {
  weather_alerts?: Array<{
    kind: 'frost' | 'heatwave' | 'wind' | 'storm';
    date: string;
    value: number | null;
    unit: string | null;
    entity_url: string;
    severity: 'critical' | 'warning';
  }>;
  overdue_tasks?: unknown[];
  expiring_warranties?: unknown[];
  due_maintenances?: unknown[];
  low_stock?: unknown[];
}

/**
 * Stubs GET /api/alerts/summary/ with the provided data.
 * All other categories default to empty arrays.
 * `total` is computed as the sum of all categories.
 */
async function stubAlertsSummary(
  page: import('@playwright/test').Page,
  override: AlertsSummaryOverride = {},
): Promise<void> {
  const overdueTasks = override.overdue_tasks ?? [];
  const expiringWarranties = override.expiring_warranties ?? [];
  const dueMaintenances = override.due_maintenances ?? [];
  const lowStock = override.low_stock ?? [];
  const weatherAlerts = override.weather_alerts ?? [];

  const total =
    overdueTasks.length +
    expiringWarranties.length +
    dueMaintenances.length +
    lowStock.length +
    weatherAlerts.length;

  const body = {
    overdue_tasks: overdueTasks,
    expiring_warranties: expiringWarranties,
    due_maintenances: dueMaintenances,
    low_stock: lowStock,
    weather_alerts: weatherAlerts,
    total,
  };

  await page.route('**/api/alerts/summary/', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10);

const FROST_ALERT = {
  kind: 'frost' as const,
  date: TODAY,
  value: -3,
  unit: '°C',
  entity_url: '/app/weather',
  severity: 'critical' as const,
};

const HEATWAVE_ALERT = {
  kind: 'heatwave' as const,
  date: TODAY,
  value: 38,
  unit: '°C',
  entity_url: '/app/weather',
  severity: 'warning' as const,
};

// ---------------------------------------------------------------------------
// 1. AlertsPage — section Météo avec alertes gel + canicule
// ---------------------------------------------------------------------------

test.describe('Alertes météo — section Météo sur /app/alerts', () => {
  test.beforeEach(async ({ page }) => {
    await stubAlertsSummary(page, {
      weather_alerts: [FROST_ALERT, HEATWAVE_ALERT],
    });
    await page.goto('/app/alerts');
    // Wait for the page heading to confirm the page is loaded
    await expect(page.getByRole('heading', { name: 'Alertes' })).toBeVisible();
  });

  test('affiche la section "Météo" avec les deux alertes', async ({ page }) => {
    // The section heading uses t('alerts.sections.weather') = "Météo"
    // It is an <h2> rendered inside a <section>
    const weatherHeading = page.getByText('Météo', { exact: true }).first();
    await expect(weatherHeading).toBeVisible();

    // Frost alert: t('alerts.weather.frost', { value: -3 }) = "Gel : jusqu'à -3°C"
    await expect(page.getByText(/Gel/)).toBeVisible();

    // Heatwave alert: t('alerts.weather.heatwave', { value: 38 }) = "Canicule : jusqu'à 38°C"
    await expect(page.getByText(/Canicule/)).toBeVisible();
  });

  test('affiche un badge de sévérité "Urgent" pour l\'alerte gel (critical)', async ({ page }) => {
    // t('alerts.severity.critical') = "Urgent"
    // There may be multiple "Urgent" badges — at least one must be visible
    await expect(page.getByText('Urgent').first()).toBeVisible();
  });

  test('affiche un badge de sévérité "À surveiller" pour l\'alerte canicule (warning)', async ({ page }) => {
    // t('alerts.severity.warning') = "À surveiller"
    await expect(page.getByText('À surveiller').first()).toBeVisible();
  });

  test('les alertes météo sont des liens vers /app/weather', async ({ page }) => {
    // Each AlertCard wraps a Link to entity_url ('/app/weather' for both stubs)
    const frostCard = page.getByRole('link', { name: /Gel/ });
    await expect(frostCard).toBeVisible();
    await expect(frostCard).toHaveAttribute('href', '/app/weather');

    const heatwaveCard = page.getByRole('link', { name: /Canicule/ });
    await expect(heatwaveCard).toBeVisible();
    await expect(heatwaveCard).toHaveAttribute('href', '/app/weather');
  });

  test('cliquer sur l\'alerte gel navigue vers /app/weather', async ({ page }) => {
    await page.getByRole('link', { name: /Gel/ }).click();
    await expect(page).toHaveURL(/\/app\/weather/);
  });
});

// ---------------------------------------------------------------------------
// 2. AlertsPage — état vide quand weather_alerts: [] et total = 0
// ---------------------------------------------------------------------------

test.describe('Alertes météo — état vide sur /app/alerts', () => {
  test('affiche l\'empty state "Tout est sous contrôle." quand aucune alerte', async ({ page }) => {
    await stubAlertsSummary(page, { weather_alerts: [] });
    await page.goto('/app/alerts');

    // t('alerts.empty') = "Tout est sous contrôle."
    await expect(page.getByText('Tout est sous contrôle.')).toBeVisible();

    // The "Météo" section must NOT be present in main content when weather_alerts is empty
    // It renders null when summary.weather_alerts.length === 0.
    // Scope to `main` to avoid matching the sidebar nav "Météo" link.
    await expect(page.locator('main').getByText('Météo', { exact: true })).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 3. AlertsPage — alerte vent (avec valeur) et orage (sans valeur)
// ---------------------------------------------------------------------------

test.describe('Alertes météo — alertes vent et orage', () => {
  test.beforeEach(async ({ page }) => {
    await stubAlertsSummary(page, {
      weather_alerts: [
        {
          kind: 'wind',
          date: TODAY,
          value: 95,
          unit: 'km/h',
          entity_url: '/app/weather',
          severity: 'warning',
        },
        {
          kind: 'storm',
          date: TODAY,
          value: null,
          unit: null,
          entity_url: '/app/weather',
          severity: 'critical',
        },
      ],
    });
    await page.goto('/app/alerts');
    await expect(page.getByRole('heading', { name: 'Alertes' })).toBeVisible();
  });

  test('affiche l\'alerte vent avec la valeur interpolée', async ({ page }) => {
    // t('alerts.weather.wind', { value: 95 }) = "Vent fort : rafales jusqu'à 95 km/h"
    await expect(page.getByText(/Vent fort/)).toBeVisible();
  });

  test('affiche l\'alerte orage sans valeur (pas d\'interpolation)', async ({ page }) => {
    // t('alerts.weather.storm') = "Orage prévu"  (no {{value}} in the key)
    await expect(page.getByText('Orage prévu')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Dashboard TriageSection — alertes météo intégrées
// ---------------------------------------------------------------------------

test.describe('Dashboard TriageSection — alertes météo', () => {
  test('les alertes météo apparaissent dans la section "À surveiller" du dashboard', async ({
    page,
  }) => {
    await stubAlertsSummary(page, {
      weather_alerts: [FROST_ALERT],
    });
    await page.goto('/app/dashboard');

    // Wait for the dashboard h1 to be ready (authenticated)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // TriageSection title uses t('dashboard.triage.title') which varies — look for the
    // frost alert title directly inside main, which is built from t('alerts.weather.frost')
    await expect(page.locator('main').getByText(/Gel/).first()).toBeVisible();
  });

  test('le badge "Urgent" est visible dans TriageSection pour une alerte gel (critical)', async ({
    page,
  }) => {
    await stubAlertsSummary(page, {
      weather_alerts: [FROST_ALERT],
    });
    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // t('alerts.severity.critical') = "Urgent"
    await expect(page.locator('main').getByText('Urgent').first()).toBeVisible();
  });

  test('TriageSection absente quand weather_alerts vides et total = 0', async ({ page }) => {
    await stubAlertsSummary(page, { weather_alerts: [] });
    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // TriageSection renders null when data.total === 0 — check that the "Voir tout" link
    // (unique to TriageSection) is absent from main
    const viewAllLink = page.locator('main').getByRole('link', { name: 'Voir tout' });
    await expect(viewAllLink).toHaveCount(0);
  });
});
