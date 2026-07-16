---
name: weather_overlay_patterns
description: Patterns overlay météo sur les graphes de consommation eau/électricité (parcours 17, Lot 6)
type: ui-pattern
---

# Overlay météo — ConsumptionBarChart

## Condition de visibilité du toggle

`WeatherOverlayToggle` (FilterPill "Météo") s'affiche seulement si :
- `household?.latitude != null && household?.longitude != null` (lat/lon présents)
- Le module weather n'est pas dans `disabled_modules`
- La granularité courante est `day` ou `month` (pas `hour` ni `year`)

## Stub nécessaire pour que le toggle apparaisse

La démo seed n'inscrit PAS de lat/lon sur le foyer Mercier. Il faut
stub `**/api/households/**` pour y injecter des coordonnées :

```typescript
await page.route('**/api/households/**', async (route) => {
  if (route.request().method() !== 'GET') { await route.continue(); return; }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'demo-household',
      name: 'Mercier',
      // ... champs obligatoires ...
      latitude: 48.8566,
      longitude: 2.3522,
      disabled_modules: [],
    }]),
  });
});
```

## Stub page Eau : readings + consumption summary

WaterPage affiche l'EmptyState si `readings.length === 0`. Pour accéder
au chart (et donc au toggle) sans vraies données :

```typescript
// Un seul relevé suffit pour skip EmptyState
await page.route('**/api/water/readings/**', async (route) => {
  if (route.request().method() !== 'GET') { await route.continue(); return; }
  await route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 'stub', reading_date: YESTERDAY, index_m3: '1250.500', ... }]) });
});

// Summary avec au moins 2 buckets pour que le chart rendu soit non vide
await page.route('**/api/water/consumption/summary/**', async (route) => {
  if (route.request().method() !== 'GET') { await route.continue(); return; }
  await route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ granularity: 'day', total_l: 200_000,
      buckets: [{ ts: YESTERDAY, total_l: 120_000 }, { ts: TODAY, total_l: 80_000 }] }) });
});
```

## Stub weather history (déclenché au clic sur le toggle)

```typescript
await page.route('**/api/weather/history/**', async (route) => {
  if (route.request().method() !== 'GET') { await route.continue(); return; }
  await route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ configured: true,
      points: [{ date: YESTERDAY, temp_mean: 14.2 }, { date: TODAY, temp_mean: 17.5 }] }) });
});
```

## Attendre la requête history après le clic

```typescript
const historyRequestPromise = page.waitForRequest('**/api/weather/history/**');
await page.getByRole('button', { name: 'Météo', exact: true }).click();
await historyRequestPromise;
```

## Sélecteurs du toggle et du graphe avec overlay

```typescript
// Toggle (FilterPill)
const toggle = page.getByRole('button', { name: 'Météo', exact: true });

// Légende recharts "Température" (overlay.label)
await expect(page.locator('main').getByText('Température')).toBeVisible();

// Ligne SVG recharts (Line component)
await expect(page.locator('.recharts-line').first()).toBeVisible();
```

## Piège : globs dans les commentaires JSDoc

Les `**` dans les backtick-strings d'un commentaire JSDoc (ex : `` `**/api/foo/**` ``)
sont interprétés comme un glob par Playwright lors de la collecte des fichiers de test.
→ Ne jamais mettre de `**` dans les commentaires des fichiers .spec.ts.
Utiliser `/api/foo/` sans les globs dans la prose.

## Strings i18n overlay

- `weather.overlay.toggle` → FR : "Météo"
- `weather.overlay.temperature` → FR : "Température"

## Endpoint history

`GET /api/weather/history/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
Réponse : `{ configured: boolean, points: [{ date: "YYYY-MM-DD", temp_mean: number }] }`
