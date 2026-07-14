import { test, expect } from './fixtures';
import type { Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------

/**
 * Stubs GET /api/weather/ with `{configured: false}` so tests are fully
 * deterministic (no Open-Meteo call, no household location required).
 */
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
 * Stubs GET /api/weather/ with a realistic `configured: true` payload
 * containing current conditions, today's hourly strip and a 2-day daily
 * forecast.  Only the fields the UI actually reads are populated.
 */
async function stubWeatherConfigured(
  page: import('@playwright/test').Page,
): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

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
      { time: `${today}T09:00`, temperature: 16, precipitation_probability: 0, weather_code: 1, condition: 'partly_cloudy' },
      { time: `${today}T12:00`, temperature: 18, precipitation_probability: 5, weather_code: 1, condition: 'partly_cloudy' },
      { time: `${today}T15:00`, temperature: 19, precipitation_probability: 10, weather_code: 2, condition: 'cloudy' },
    ],
    daily: [
      {
        date: today,
        weather_code: 1,
        condition: 'partly_cloudy',
        temp_max: 20,
        temp_min: 12,
        precipitation_probability_max: 10,
        sunrise: `${today}T06:15`,
        sunset: `${today}T21:05`,
      },
      {
        date: tomorrow,
        weather_code: 61,
        condition: 'rain',
        temp_max: 15,
        temp_min: 10,
        precipitation_probability_max: 80,
        sunrise: `${tomorrow}T06:16`,
        sunset: `${tomorrow}T21:04`,
      },
    ],
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
// 1. WeatherPage — non configuré
// ---------------------------------------------------------------------------

test.describe('Météo — non configuré', () => {
  test.beforeEach(async ({ page }) => {
    await stubWeatherNotConfigured(page);
    await page.goto('/app/weather');
  });

  test('affiche le titre "Météo" et l\'EmptyState "Aucun lieu défini"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Météo' })).toBeVisible();
    await expect(page.getByText('Aucun lieu défini')).toBeVisible();
    await expect(
      page.getByText('Définissez la localisation de votre maison pour voir la météo locale.'),
    ).toBeVisible();
  });

  test('le CTA "Définir le lieu" pointe vers /app/settings', async ({ page }) => {
    const cta = page.getByRole('link', { name: 'Définir le lieu' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/app/settings');
  });

  test('cliquer sur "Définir le lieu" navigue vers les paramètres', async ({ page }) => {
    await page.getByRole('link', { name: 'Définir le lieu' }).click();
    await expect(page).toHaveURL(/\/app\/settings/);
  });
});

// ---------------------------------------------------------------------------
// 2. WeatherPage — configuré (prévisions stubées)
// ---------------------------------------------------------------------------

test.describe('Météo — configuré avec prévisions', () => {
  test.beforeEach(async ({ page }) => {
    await stubWeatherConfigured(page);
    await page.goto('/app/weather');
  });

  test('affiche le titre "Météo" avec le libellé du lieu en description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Météo' })).toBeVisible();
    await expect(page.getByText('Paris, Île-de-France, France')).toBeVisible();
  });

  test('affiche la température actuelle (18°)', async ({ page }) => {
    // The current conditions card shows the big temperature as "18°" in a <p>
    // tag. Multiple elements may show "18°" (also in hourly strip) so scope to
    // the first match which is the prominent current-conditions paragraph.
    await expect(page.getByText('18°').first()).toBeVisible();
  });

  test('affiche la section "Aujourd\'hui" avec le ruban horaire', async ({ page }) => {
    await expect(page.getByText("Aujourd'hui")).toBeVisible();
  });

  test('affiche la section "Prévisions sur 7 jours"', async ({ page }) => {
    await expect(page.getByText('Prévisions sur 7 jours')).toBeVisible();
  });

  test('la section des prévisions contient "Auj." (premier jour)', async ({ page }) => {
    // The first DayRow renders with the t('weather.dayToday') = "Auj." label
    await expect(page.getByText('Auj.')).toBeVisible();
  });

  test('affiche le lien "Changer de lieu" vers /app/settings', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Changer de lieu' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/app/settings');
  });
});

// ---------------------------------------------------------------------------
// 3. WeatherPage — erreur Open-Meteo
// ---------------------------------------------------------------------------

test.describe('Météo — erreur API externe', () => {
  test('affiche le message d\'erreur quand Open-Meteo est indisponible', async ({ page }) => {
    await page.route('**/api/weather/', async (route: Route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true, error: true }),
      });
    });

    await page.goto('/app/weather');
    await expect(page.getByText('Météo indisponible pour le moment. Réessayez plus tard.')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Dashboard — widget Météo
// ---------------------------------------------------------------------------

test.describe('Dashboard — widget Météo', () => {
  test('le widget Météo est affiché quand la météo est configurée', async ({ page }) => {
    await stubWeatherConfigured(page);
    await page.goto('/app/dashboard');

    // The WeatherCard links to /app/weather and shows the title + temperature
    const weatherCard = page.locator('main').getByRole('link', { name: /Météo/ });
    await expect(weatherCard).toBeVisible();
  });

  test('cliquer sur le widget Météo navigue vers /app/weather', async ({ page }) => {
    await stubWeatherConfigured(page);
    await page.goto('/app/dashboard');

    const weatherCard = page.locator('main').getByRole('link', { name: /Météo/ });
    await expect(weatherCard).toBeVisible();
    await weatherCard.click();
    await expect(page).toHaveURL(/\/app\/weather/);
  });

  test('le widget Météo est absent quand non configuré', async ({ page }) => {
    await stubWeatherNotConfigured(page);
    await page.goto('/app/dashboard');

    // Wait for the dashboard to fully render (check a known always-visible element)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Weather card renders null when !configured — no link to /app/weather in main
    const weatherCard = page.locator('main').getByRole('link', { name: /Météo/ });
    await expect(weatherCard).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Sidebar — entrée Météo
// ---------------------------------------------------------------------------

test.describe('Sidebar — module Météo', () => {
  test('la sidebar affiche un lien "Météo" vers /app/weather', async ({ page }) => {
    await page.goto('/app/dashboard');
    const sidebar = page.locator('aside');
    const weatherLink = sidebar.getByRole('link', { name: 'Météo' });
    await expect(weatherLink).toBeVisible();
    await expect(weatherLink).toHaveAttribute('href', '/app/weather');
  });
});
