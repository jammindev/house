---
name: alerts_weather_patterns
description: Patterns for E2E testing weather alerts on /app/alerts and the dashboard TriageSection (parcours 17 Lot 4)
type: module-patterns
---

# Alertes météo E2E Patterns

## Endpoint stub: /api/alerts/summary/

Stub pattern (must be registered before `page.goto`):

```typescript
await page.route('**/api/alerts/summary/', async (route) => {
  if (route.request().method() !== 'GET') {
    await route.continue();
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      overdue_tasks: [],
      expiring_warranties: [],
      due_maintenances: [],
      low_stock: [],
      weather_alerts: [
        { kind: 'frost', date: TODAY, value: -3, unit: '°C', entity_url: '/app/weather', severity: 'critical' },
        { kind: 'heatwave', date: TODAY, value: 38, unit: '°C', entity_url: '/app/weather', severity: 'warning' },
      ],
      total: 2,
    }),
  });
});
```

`total` MUST match the sum of all arrays — the page branches on `total === 0` to show empty state.

## WeatherAlert shape

```typescript
interface WeatherAlert {
  kind: 'frost' | 'heatwave' | 'wind' | 'storm';
  date: string;   // YYYY-MM-DD
  value: number | null;
  unit: string | null;
  entity_url: string;  // always '/app/weather'
  severity: 'critical' | 'warning';
}
```

## French string interpolation

| kind | value | rendered text |
|------|-------|---------------|
| `frost` | -3 | "Gel : jusqu'à -3°C" |
| `heatwave` | 38 | "Canicule : jusqu'à 38°C" |
| `wind` | 95 | "Vent fort : rafales jusqu'à 95 km/h" |
| `storm` | null | "Orage prévu" (no interpolation) |

Severity badges: `critical` → "Urgent", `warning` → "À surveiller"

Section heading: `alerts.sections.weather` → "Météo"

## Selectors — strict-mode traps

### "Météo" is ambiguous — scope to `main`

"Météo" appears in:
1. The sidebar nav link (aside)
2. The section `<h2>` in the alerts page

To assert the section is present:
```typescript
// ✅ The section heading is inside <main>
const weatherHeading = page.getByText('Météo', { exact: true }).first();
await expect(weatherHeading).toBeVisible();
```

To assert the section is ABSENT from main content (not confused with sidebar):
```typescript
// ✅ Scope to main, use toHaveCount(0)
await expect(page.locator('main').getByText('Météo', { exact: true })).toHaveCount(0);
// ❌ This would fail — sidebar still has "Météo"
await expect(page.getByText(/Météo/).first()).not.toBeVisible();
```

### Alert cards are `<Link>` elements

`AlertCard` renders as a `<Link>` wrapping a `<Card>`. The link accessible name
includes the title text, so `getByRole('link', { name: /Gel/ })` works:

```typescript
const frostCard = page.getByRole('link', { name: /Gel/ });
await expect(frostCard).toBeVisible();
await expect(frostCard).toHaveAttribute('href', '/app/weather');
```

## Build requirement

The AlertsPage weather section was added in parcours 17 Lot 4. If `npm run build`
was not run after the feature was merged, the built chunk `AlertsPage-*.js` will NOT
contain `weather_alerts` and the stub will appear to render an empty page (subtitle
visible, no sections). Always rebuild before running this spec.

## TriageSection on dashboard

Weather alerts are folded into `TriageSection` alongside other alert types.
The TriageSection renders `null` when `data.total === 0`.

```typescript
// Assert weather alert title visible in main
await expect(page.locator('main').getByText(/Gel/).first()).toBeVisible();

// Assert TriageSection absent when total=0
// "Voir tout" link (linking to /app/alerts) is unique to TriageSection
await expect(page.locator('main').getByRole('link', { name: 'Voir tout' })).toHaveCount(0);
```

## Empty state

When `total === 0` the page shows `t('alerts.empty')` = "Tout est sous contrôle." and
hides all sections. The subtitle "Ce qui demande attention dans votre foyer." is only
shown when `total > 0`.
