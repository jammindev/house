/**
 * E2E — Tâches "temps sec" (parcours 17, Lot 3)
 *
 * All weather API calls are stubbed via page.route so tests are fully
 * deterministic (no live Open-Meteo request, no household location needed).
 *
 * Weather module must be enabled for the demo household (it is by default).
 *
 * Auth is handled by storageState in playwright.config.ts — no inline login.
 */

import { test, expect } from './fixtures';
import type { Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Agent privacy consent helper
// ---------------------------------------------------------------------------

/**
 * Pre-accept the agent privacy notice so the consent dialog doesn't block
 * assertions on task detail pages (which embed EntityAssistant).
 * Must be called AFTER page.goto so localStorage is accessible.
 */
const AGENT_PRIVACY_KEY = 'agent.privacyAccepted.v2';

async function acceptAgentPrivacy(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.evaluate(
    ([key]) => {
      localStorage.setItem(key as string, 'true');
    },
    [AGENT_PRIVACY_KEY],
  );
}

// ---------------------------------------------------------------------------
// Weather stub helpers
// ---------------------------------------------------------------------------

async function stubWeatherNotConfigured(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.route('**/api/weather/', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: false }),
    });
  });
}

/**
 * Stub with a mix of dry and rainy days — used to assert the suggestion card
 * shows at least one favorable day.
 *
 * Dry day  : precipitation_probability_max <= 30
 * Rainy day: precipitation_probability_max > 30
 */
async function stubWeatherWithMixedDays(
  page: import('@playwright/test').Page,
): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);
    const isDry = i % 2 === 0; // day 0, 2, 4, 6 are dry
    return {
      date: dateStr,
      weather_code: isDry ? 1 : 61,
      condition: isDry ? 'partly_cloudy' : 'rain',
      temp_max: isDry ? 22 : 14,
      temp_min: 10,
      precipitation_probability_max: isDry ? 10 : 75,
      sunrise: `${dateStr}T06:15`,
      sunset: `${dateStr}T21:05`,
    };
  });

  const payload = {
    configured: true,
    latitude: 48.8566,
    longitude: 2.3522,
    location_label: 'Paris, Île-de-France, France',
    timezone: 'Europe/Paris',
    units: { temperature: '°C', wind_speed: 'km/h' },
    current: {
      time: now.toISOString(),
      temperature: 18,
      apparent_temperature: 16,
      humidity: 65,
      wind_speed: 12,
      weather_code: 1,
      condition: 'partly_cloudy',
      is_day: true,
    },
    hourly: [
      {
        time: `${today}T09:00`,
        temperature: 16,
        precipitation_probability: 5,
        weather_code: 1,
        condition: 'partly_cloudy',
      },
    ],
    daily: days,
  };

  await page.route('**/api/weather/', async (route: Route) => {
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
 * Stub where every day has precipitation > 30 % — no dry day available.
 */
async function stubWeatherAllRainy(
  page: import('@playwright/test').Page,
): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);
    return {
      date: dateStr,
      weather_code: 61,
      condition: 'rain',
      temp_max: 13,
      temp_min: 9,
      precipitation_probability_max: 85,
      sunrise: `${dateStr}T06:15`,
      sunset: `${dateStr}T21:05`,
    };
  });

  const payload = {
    configured: true,
    latitude: 48.8566,
    longitude: 2.3522,
    location_label: 'Paris, Île-de-France, France',
    timezone: 'Europe/Paris',
    units: { temperature: '°C', wind_speed: 'km/h' },
    current: {
      time: now.toISOString(),
      temperature: 11,
      apparent_temperature: 9,
      humidity: 90,
      wind_speed: 20,
      weather_code: 61,
      condition: 'rain',
      is_day: true,
    },
    hourly: [
      {
        time: `${today}T09:00`,
        temperature: 11,
        precipitation_probability: 90,
        weather_code: 61,
        condition: 'rain',
      },
    ],
    daily: days,
  };

  await page.route('**/api/weather/', async (route: Route) => {
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

// ---------------------------------------------------------------------------
// 1. Création — badge CloudSun sur la carte
// ---------------------------------------------------------------------------

test.describe('Tâche "temps sec" — badge sur la liste', () => {
  test('créer une tâche avec "Nécessite un temps sec" → badge CloudSun visible sur la carte', async ({
    page,
  }) => {
    // Stub weather so the module is enabled (needed for checkbox visibility)
    await stubWeatherWithMixedDays(page);
    await page.goto('/app/tasks');

    const subject = `Tâche temps sec E2E ${Date.now()}`;

    await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Titre de la tâche…').fill(subject);

    // Check the "needs dry weather" checkbox — only shown when weather module enabled
    const checkbox = page.locator('#task-needs-dry-weather');
    await expect(checkbox).toBeVisible();
    await checkbox.check();

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    // The task card should appear with the CloudSun badge aria-label
    await expect(page.getByText(subject)).toBeVisible();

    // CloudSun icon has aria-label = t('tasks.weather.needsDryWeatherBadge') = "Nécessite un temps sec"
    const taskCard = page.getByText(subject, { exact: true }).locator('xpath=ancestor::*[4]');
    await expect(
      taskCard.getByRole('img', { name: 'Nécessite un temps sec' }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Détail — suggestion des jours secs (forecast mixte)
// ---------------------------------------------------------------------------

test.describe('Tâche "temps sec" — suggestions météo sur le détail', () => {
  test('carte de suggestions visible avec des jours secs disponibles', async ({
    page,
  }) => {
    await stubWeatherWithMixedDays(page);
    await page.goto('/app/tasks');

    // Pre-accept agent privacy so the consent dialog doesn't block heading assertions
    await acceptAgentPrivacy(page);

    const subject = `Suggestion temps sec E2E ${Date.now()}`;

    // Create task with needs_dry_weather=true and NO due date
    await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Titre de la tâche…').fill(subject);
    // Leave #task-date empty (no due date) — required for TaskWeatherHint to render
    await page.locator('#task-needs-dry-weather').check();
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(subject)).toBeVisible();

    // Navigate to the task detail page
    await page.getByRole('button', { name: subject, exact: true }).click();
    await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: subject })).toBeVisible();

    // The TaskWeatherHint card renders its title when there are dry days
    await expect(page.getByText('Meilleurs jours')).toBeVisible();

    // The intro "Jours secs à venir :" should appear
    await expect(page.getByText('Jours secs à venir :')).toBeVisible();
  });

  test('carte de suggestions affiche "Aucun jour sec" quand tous les jours sont pluvieux', async ({
    page,
  }) => {
    await stubWeatherAllRainy(page);
    await page.goto('/app/tasks');

    // Pre-accept agent privacy so the consent dialog doesn't block heading assertions
    await acceptAgentPrivacy(page);

    const subject = `Tous pluvieux E2E ${Date.now()}`;

    // Create task with needs_dry_weather=true and NO due date
    await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Titre de la tâche…').fill(subject);
    await page.locator('#task-needs-dry-weather').check();
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(subject)).toBeVisible();

    // Navigate to detail
    await page.getByRole('button', { name: subject, exact: true }).click();
    await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: subject })).toBeVisible();

    // The hint card shows — title + noDryDays message
    await expect(page.getByText('Meilleurs jours')).toBeVisible();
    await expect(
      page.getByText('Aucun jour sec prévu dans les 7 prochains jours.'),
    ).toBeVisible();
  });

  test('carte de suggestions absente quand météo non configurée', async ({
    page,
  }) => {
    await stubWeatherNotConfigured(page);
    await page.goto('/app/tasks');

    // Pre-accept agent privacy so the consent dialog doesn't block heading assertions
    await acceptAgentPrivacy(page);

    const subject = `Non configurée E2E ${Date.now()}`;

    // Create task with needs_dry_weather checkbox (weather module may still be
    // "enabled" in household settings even when location is not configured;
    // the checkbox appears based on the module flag, not the weather response).
    await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Titre de la tâche…').fill(subject);
    const checkbox = page.locator('#task-needs-dry-weather');
    const checkboxVisible = await checkbox.isVisible();
    if (checkboxVisible) {
      await checkbox.check();
    }
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(subject)).toBeVisible();

    // Navigate to detail
    await page.getByRole('button', { name: subject, exact: true }).click();
    await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: subject })).toBeVisible();

    // Weather hint must NOT appear when configured:false
    // (TaskWeatherHint returns null when !data.configured)
    await expect(page.getByText('Meilleurs jours')).not.toBeVisible();
  });
});
