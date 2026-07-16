---
name: weather_module_patterns
description: Patterns for E2E testing the weather module (/app/weather)
type: module-patterns
---

# Weather Module E2E Patterns

## Route interception (critical — no live Open-Meteo calls)

Always stub `GET /api/weather/` before `page.goto()`. The baseURL is `/api` so the
full URL pattern is `**/api/weather/**`.

```typescript
await page.route('**/api/weather/', async (route) => {
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
await page.goto('/app/weather');
```

Pass `route.continue()` for non-GET methods to avoid accidentally blocking other
requests. Do NOT use `page.unroute` — registering in `beforeEach` is enough since
the route is scoped to the page context.

## Module is optional — must be in frontend build

The weather module (key `weather`) is in `OPTIONAL_MODULES` and enabled by default
for new households. However:
- If the static build predates the weather feature, the route renders 404.
- Run `npm run build` to produce `static/react/assets/WeatherPage-*.js` and
  `static/react/assets/weather-*.js`.
- The sidebar entry "Météo" confirms the module is loaded.

## French strings

| Key | Value |
|-----|-------|
| `weather.title` | "Météo" |
| `weather.notConfigured.title` | "Aucun lieu défini" |
| `weather.notConfigured.description` | "Définissez la localisation de votre maison pour voir la météo locale." |
| `weather.notConfigured.cta` | "Définir le lieu" |
| `weather.changeLocation` | "Changer de lieu" |
| `weather.today` | "Aujourd'hui" |
| `weather.dayToday` | "Auj." |
| `weather.forecast7d` | "Prévisions sur 7 jours" |
| `weather.error` | "Météo indisponible pour le moment. Réessayez plus tard." |

## Strict-mode pitfall: temperature value

When the stub returns `temperature: 18`, the string "18°" appears in BOTH:
1. The current-conditions `<p>` (text-4xl)
2. Hourly strip `<span>` elements at the same hour

`getByText('18°')` will throw strict mode violation (2 matches).
Fix: use `.first()` or scope to the conditions card:

```typescript
// ✅
await expect(page.getByText('18°').first()).toBeVisible();
```

## Dashboard WeatherCard

`WeatherCard` renders null when `!configured || error || !current`. To assert
the widget is present, use:

```typescript
const weatherCard = page.locator('main').getByRole('link', { name: /Météo/ });
await expect(weatherCard).toBeVisible();
```

Scoping to `main` avoids matching the sidebar "Météo" link.

## Sidebar entry

```typescript
const sidebar = page.locator('aside');
await expect(sidebar.getByRole('link', { name: 'Météo' })).toBeVisible();
await expect(sidebar.getByRole('link', { name: 'Météo' })).toHaveAttribute('href', '/app/weather');
```

## Configured stub payload structure

Minimum viable payload for `configured: true` tests:

```typescript
{
  configured: true,
  location_label: 'Paris, Île-de-France, France',
  units: { temperature: '°C', wind_speed: 'km/h' },
  current: {
    time: new Date().toISOString(),
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
  ],
  daily: [
    { date: today, condition: 'partly_cloudy', temp_max: 20, temp_min: 12, precipitation_probability_max: 10, sunrise: ..., sunset: ..., weather_code: 1 },
  ],
}
```

Error state stub: `{ configured: true, error: true }` → shows "Météo indisponible..."
