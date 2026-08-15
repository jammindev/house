import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E — Entretien saisonnier (parcours 30, lot 5).
 *
 * Concept et alternatives écartées : `docs/fiches/CADENCE_SAISONNIERE.md`.
 */

async function auth(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function listJson<T>(page: Page, url: string): Promise<T[]> {
  const resp = await page.request.get(url, { headers: await auth(page) });
  if (!resp.ok()) return [];
  const body = (await resp.json()) as unknown;
  return Array.isArray(body) ? (body as T[]) : ((body as { results?: T[] }).results ?? []);
}

async function createZone(page: Page): Promise<{ id: string; name: string }> {
  const resp = await page.request.post('/api/zones/', {
    headers: await auth(page),
    data: { name: `Verger E2E ${Date.now()}-${Math.floor(Math.random() * 1e6)}` },
  });
  return (await resp.json()) as { id: string; name: string };
}

async function cleanup(page: Page, zoneId?: string): Promise<void> {
  for (const rule of await listJson<{ id: string }>(page, '/api/orchard/care-rules/')) {
    await page.request.delete(`/api/orchard/care-rules/${rule.id}/`, { headers: await auth(page) });
  }
  for (const tree of await listJson<{ id: string }>(page, '/api/orchard/trees/?status=all')) {
    await page.request.delete(`/api/orchard/trees/${tree.id}/`, { headers: await auth(page) });
  }
  if (zoneId) await page.request.delete(`/api/zones/${zoneId}/`, { headers: await auth(page) });
}

async function createTree(page: Page, name: string, zoneId: string): Promise<{ id: string }> {
  const resp = await page.request.post('/api/orchard/trees/', {
    headers: await auth(page),
    data: { name, zone_id: zoneId },
  });
  if (!resp.ok()) throw new Error(`sujet impossible : ${resp.status()} ${await resp.text()}`);
  return (await resp.json()) as { id: string };
}

/** Une règle ouverte toute l'année — elle est donc « due » quel que soit le jour du test. */
async function createAlwaysOpenRule(page: Page, name: string, treeId: string): Promise<void> {
  const resp = await page.request.post('/api/orchard/care-rules/', {
    headers: await auth(page),
    data: { name, start_month: 1, end_month: 12, tree: treeId, event_type: 'pruning' },
  });
  if (!resp.ok()) throw new Error(`règle impossible : ${resp.status()} ${await resp.text()}`);
}

test.describe('Entretien saisonnier', () => {
  let zone: { id: string; name: string };

  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await cleanup(page);
    zone = await createZone(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page, zone.id);
  });

  test('ORCH-04 — la page ouvre sur ce que la saison réclame, et « c\'est fait » la solde', async ({
    page,
  }) => {
    const tree = await createTree(page, `Pommier ${Date.now()}`, zone.id);
    await createAlwaysOpenRule(page, 'Taille de saison', tree.id);

    await page.goto('/app/orchard');
    await expect(page.getByText(/ce que la saison réclame/i)).toBeVisible();
    await expect(page.getByText(/taille de saison/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^c'est fait$/i }).first().click();

    // La ligne quitte le panneau — l'état n'est stocké nulle part, c'est l'entrée
    // de journal qui vient d'être écrite qui le fait basculer. On vise le bouton
    // et non le titre : celui-ci réapparaît légitimement dans le journal, sous
    // l'intitulé de l'entrée créée.
    await expect(page.getByRole('button', { name: /^c'est fait$/i })).toHaveCount(0);

    const events = await listJson<{ care_rule: string | null; type: string }>(
      page,
      `/api/orchard/events/?tree=${tree.id}`,
    );
    expect(events).toHaveLength(1);
    expect(events[0].care_rule).not.toBeNull();
    expect(events[0].type).toBe('pruning');
  });

  test('ORCH-04 — une fenêtre à cheval sur deux années se crée depuis l\'écran', async ({
    page,
  }) => {
    const tree = await createTree(page, `Prunier ${Date.now()}`, zone.id);

    await page.goto('/app/orchard');
    await page.getByRole('button', { name: /nouvelle règle/i }).first().click();

    await page.getByLabel(/^Nom/).fill("Taille d'hiver");
    // Novembre → mars : le défaut proposé, parce que c'est le cas normal d'un
    // verger et non le cas limite.
    await page.getByLabel(/du mois de/i).selectOption('11');
    await page.getByLabel(/au mois de/i).selectOption('3');
    await page.getByLabel(/portée/i).selectOption('tree');
    await page.getByLabel(/^Sujet/).selectOption(tree.id);
    await page.getByRole('button', { name: /^enregistrer$/i }).click();

    const rules = await listJson<{ name: string; start_month: number; end_month: number }>(
      page,
      '/api/orchard/care-rules/',
    );
    const winter = rules.find((r) => r.name === "Taille d'hiver");
    expect(winter).toBeTruthy();
    expect([winter?.start_month, winter?.end_month]).toEqual([11, 3]);
  });

  test('ORCH-05 — une règle échue devient une tâche datée, jamais toute seule', async ({
    page,
  }) => {
    // Nom unique : la base E2E n'est pas remise à zéro entre les exécutions, et
    // une tâche laissée par un run précédent ferait passer la vérification
    // « rien n'a été fabriqué tout seul » pour un échec.
    const ruleName = `Traitement ${Date.now()}`;
    const tree = await createTree(page, `Poirier ${Date.now()}`, zone.id);
    await createAlwaysOpenRule(page, ruleName, tree.id);

    // Rien n'a été fabriqué en tâche de fond.
    const before = await listJson<{ subject: string }>(page, '/api/tasks/tasks/');
    expect(before.some((t) => t.subject.includes(ruleName))).toBe(false);

    await page.goto('/app/orchard');
    await page.getByRole('button', { name: /créer une tâche/i }).first().click();
    await expect(page.getByText(/tâche créée/i).first()).toBeVisible();

    const after = await listJson<{ subject: string; due_date: string | null }>(page, '/api/tasks/tasks/');
    const created = after.find((t) => t.subject.includes(ruleName));
    expect(created).toBeTruthy();
    // L'échéance est la fin de la fenêtre, pas une date inventée.
    expect(created?.due_date).toBeTruthy();
  });
});
