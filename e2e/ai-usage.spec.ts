import { test, expect } from './fixtures';
import type { Page, Route } from '@playwright/test';

const HOUSEHOLD_ID = 'hh-e2e-1';

async function mockHouseholds(page: Page, role: 'owner' | 'member'): Promise<void> {
  await page.route('**/api/households/', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: HOUSEHOLD_ID, name: 'E2E House', current_user_role: role, members: [] },
      ]),
    });
  });
  // The active household of the E2E user differs from HOUSEHOLD_ID; the hook
  // falls back to the first household of the list, which is what we mock.
}

async function mockAIUsage(page: Page): Promise<void> {
  await page.route('**/api/ai-usage/summary/**', async (route: Route) => {
    const window = (calls: number, p95: number, idk: number) => ({
      calls,
      errors: 1,
      error_rate: calls ? 1 / calls : null,
      p95_ms: p95,
      idk_rate: idk,
      alerts: { idk_rate: idk > 0.3, p95_ms: p95 > 10_000 },
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        windows: {
          '24h': window(12, 2400, 0.1),
          '7d': window(80, 3100, 0.42),
          '30d': window(230, 12_500, 0.2),
        },
      }),
    });
  });

  await page.route('**/api/ai-usage/histogram/**', async (route: Route) => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return {
        date: d.toISOString().slice(0, 10),
        counts: i % 3 === 0 ? { agent_ask: 4, ocr_upload: 2 } : { agent_ask: 1 },
      };
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ days, features: ['agent_ask', 'ocr_upload'] }),
    });
  });

  await page.route('**/api/ai-usage/recent/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const feature = url.searchParams.get('feature');
    const calls = [
      {
        id: 'c1', feature: 'agent_ask', provider: 'anthropic', model: 'claude-haiku-4-5',
        input_tokens: 1200, output_tokens: 300, duration_ms: 2400, success: true,
        error_type: null, created_at: new Date().toISOString(),
      },
      {
        id: 'c2', feature: 'ocr_upload', provider: 'anthropic', model: 'claude-haiku-4-5',
        input_tokens: 900, output_tokens: 500, duration_ms: 5100, success: false,
        error_type: 'timeout', created_at: new Date().toISOString(),
      },
    ].filter((c) => !feature || c.feature === feature);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: calls }),
    });
  });
}

test('affiche les KPIs, l’histogramme et les appels récents pour un owner', async ({ page }) => {
  await mockHouseholds(page, 'owner');
  await mockAIUsage(page);

  await page.goto('/app/admin/ai-usage');

  // KPI cards — 3 fenêtres, avec le compte d'appels.
  await expect(page.getByTestId('ai-usage-kpis')).toContainText('12');
  await expect(page.getByTestId('ai-usage-kpis')).toContainText('230');

  // Histogramme + légende par feature.
  await expect(page.getByTestId('ai-usage-histogram')).toContainText('agent_ask');

  // Table des appels récents avec statut d'erreur.
  await expect(page.getByTestId('ai-usage-recent')).toContainText('timeout');

  // Filtre par feature : ne garde que les lignes agent_ask.
  await page.getByRole('button', { name: 'agent_ask' }).click();
  await expect(page.getByTestId('ai-usage-recent')).not.toContainText('timeout');
});

test('un membre non-owner voit le message réservé aux propriétaires', async ({ page }) => {
  await mockHouseholds(page, 'member');
  await mockAIUsage(page);

  await page.goto('/app/admin/ai-usage');

  await expect(page.getByText('réservée aux propriétaires')).toBeVisible();
  await expect(page.getByTestId('ai-usage-kpis')).toHaveCount(0);
});

test('l’entrée sidebar Usage IA est visible pour un owner', async ({ page }) => {
  await mockHouseholds(page, 'owner');
  await mockAIUsage(page);

  await page.goto('/app/dashboard');
  await expect(page.getByRole('link', { name: 'Usage IA' })).toBeVisible();
});
