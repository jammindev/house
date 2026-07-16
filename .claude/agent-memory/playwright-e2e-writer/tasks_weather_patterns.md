---
name: tasks_weather_patterns
description: Patterns for E2E testing the weather-aware tasks feature (parcours 17, Lot 3)
type: feature-patterns
---

# Tasks Weather-Aware E2E Patterns

## Feature summary

- `Task.needs_dry_weather` boolean field
- Checkbox `#task-needs-dry-weather` in `NewTaskDialog` — only visible when weather module enabled
- `CloudSun` icon on `TaskCard` with `aria-label = t('tasks.weather.needsDryWeatherBadge')` = "Nécessite un temps sec"
- `TaskWeatherHint` component on `TaskDetailPage` — renders ONLY when:
  - `task.needs_dry_weather === true`
  - `task.status !== 'done'`
  - `task.due_date` is null/empty
  - weather module enabled
  - `GET /api/weather/` returns `{configured:true, error:false, daily:[...]}`

## CloudSun badge selector

```typescript
// aria-label = "Nécessite un temps sec" (tasks.weather.needsDryWeatherBadge)
const taskCard = page.getByText(subject, { exact: true }).locator('xpath=ancestor::*[4]');
await expect(taskCard.getByRole('img', { name: 'Nécessite un temps sec' })).toBeVisible();
```

Note: the SVG `CloudSun` has `aria-label` set, so `getByRole('img', { name: '...' })` works.

## Weather route stub

Always register the stub BEFORE `page.goto()`:

```typescript
await page.route('**/api/weather/', async (route) => {
  if (route.request().method() !== 'GET') {
    await route.continue();
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
});
```

## Dry vs rainy day thresholds

- Dry day: `precipitation_probability_max <= 30` (or null/undefined)
- Rainy day: `precipitation_probability_max > 30`

## French strings

| i18n key | FR value |
|---|---|
| `tasks.weather.fieldNeedsDryWeather` | "Nécessite un temps sec" |
| `tasks.weather.needsDryWeatherBadge` | "Nécessite un temps sec" |
| `tasks.weather.suggestionTitle` | "Meilleurs jours" |
| `tasks.weather.goodDaysIntro` | "Jours secs à venir :" |
| `tasks.weather.noDryDays` | "Aucun jour sec prévu dans les 7 prochains jours." |

## Agent privacy — MANDATORY for task detail tests

`TaskDetailPage` embeds `EntityAssistant` which renders `ChatPanel` which opens
the `PrivacyNotice` Radix Dialog if `agent.privacyAccepted.v2` is not set in
localStorage. The Radix Dialog applies `aria-hidden` to the rest of the page,
making `getByRole('heading', { name: subject })` fail.

Fix: call `acceptAgentPrivacy(page)` AFTER `page.goto()` (so localStorage is
accessible) and BEFORE navigating to the task detail.

```typescript
const AGENT_PRIVACY_KEY = 'agent.privacyAccepted.v2';

async function acceptAgentPrivacy(page) {
  await page.evaluate(([key]) => {
    localStorage.setItem(key, 'true');
  }, [AGENT_PRIVACY_KEY]);
}

// Usage:
await page.goto('/app/tasks');
await acceptAgentPrivacy(page);  // Must be before navigating to detail
```

## Condition: task must have NO due_date for hint to appear

`TaskWeatherHint` is suppressed when `task.due_date` is set. Do NOT fill the
`#task-date` field when creating tasks that need to show the weather hint.

## Test that hint is absent (not.toBeVisible vs toHaveCount(0))

```typescript
// ✅ Use not.toBeVisible() — the element simply doesn't exist in the DOM
await expect(page.getByText('Meilleurs jours')).not.toBeVisible();
```

## Spec file location

`e2e/tasks-weather.spec.ts` — separate from `tasks.spec.ts` to keep concerns isolated.
