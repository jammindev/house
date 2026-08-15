import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E — Récoltes du verger (parcours 30, lot 4).
 *
 * Ce qui ne se prouve qu'ici : la saisie d'un décimal **dans un vrai moteur**
 * (le bug « 12,5 → 512 € » n'existait pas en jsdom) et le fait que deux unités
 * ne soient jamais additionnées à l'écran.
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

/** Une zone dédiée au test — jamais celle du jeu de démo, qu'un test supprime. */
async function createZone(page: Page): Promise<{ id: string; name: string }> {
  const resp = await page.request.post('/api/zones/', {
    headers: await auth(page),
    data: { name: `Verger E2E ${Date.now()}-${Math.floor(Math.random() * 1e6)}` },
  });
  if (!resp.ok()) throw new Error(`création de zone impossible : ${resp.status()} ${await resp.text()}`);
  return (await resp.json()) as { id: string; name: string };
}

async function deleteZone(page: Page, id: string): Promise<void> {
  await page.request.delete(`/api/zones/${id}/`, { headers: await auth(page) });
}

async function deleteAllTrees(page: Page): Promise<void> {
  const trees = await listJson<{ id: string }>(page, '/api/orchard/trees/?status=all');
  for (const tree of trees) {
    await page.request.delete(`/api/orchard/trees/${tree.id}/`, { headers: await auth(page) });
  }
}

async function createTree(page: Page, name: string, zoneId: string): Promise<{ id: string }> {
  const resp = await page.request.post('/api/orchard/trees/', {
    headers: await auth(page),
    data: { name, zone_id: zoneId },
  });
  if (!resp.ok())
    throw new Error(`création du sujet impossible : ${resp.status()} ${await resp.text()}`);
  return (await resp.json()) as { id: string };
}

async function createHarvest(
  page: Page,
  data: Record<string, unknown>,
): Promise<void> {
  const resp = await page.request.post('/api/orchard/harvests/', {
    headers: await auth(page),
    data,
  });
  if (!resp.ok()) throw new Error(`récolte impossible : ${resp.status()}`);
}

test.describe('Récoltes du verger', () => {
  let zone: { id: string; name: string };

  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await deleteAllTrees(page);
    zone = await createZone(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteAllTrees(page);
    await deleteZone(page, zone.id);
  });

  test('ORCH-06 — une quantité décimale tapée à la virgule arrive juste en base', async ({
    page,
  }) => {
    const tree = await createTree(page, `Pommier ${Date.now()}`, zone.id);

    await page.goto(`/app/orchard/${tree.id}`);
    await page.getByRole('button', { name: /récoltes/i }).first().click();
    await page.getByRole('button', { name: /ajouter une récolte/i }).first().click();

    // Clavier français : la virgule est le séparateur. Le champ est un
    // DecimalInput, dont l'état parent reste canonique (point) — c'est ce que le
    // serveur doit recevoir. En `<input type="number">`, cette frappe donnait un
    // nombre faux, sans un mot.
    await page.getByLabel(/^Quantité/).fill('12,5');
    await page.getByRole('button', { name: /^enregistrer$/i }).click();

    await expect(page.getByRole('button', { name: /ajouter une récolte/i })).toBeVisible();

    const harvests = await listJson<{ quantity: string }>(
      page,
      `/api/orchard/harvests/?tree=${tree.id}`,
    );
    expect(harvests).toHaveLength(1);
    expect(Number(harvests[0].quantity)).toBeCloseTo(12.5, 3);
  });

  test('ORCH-06 — plusieurs cueillettes dans la même saison restent distinctes', async ({
    page,
  }) => {
    const tree = await createTree(page, `Prunier ${Date.now()}`, zone.id);
    const year = new Date().getFullYear();

    await createHarvest(page, {
      tree: tree.id, harvested_on: `${year}-09-12`, quantity: '8.500', unit: 'kg',
    });
    await createHarvest(page, {
      tree: tree.id, harvested_on: `${year}-09-20`, quantity: '12.000', unit: 'kg',
    });

    const harvests = await listJson<{ id: string }>(
      page,
      `/api/orchard/harvests/?tree=${tree.id}`,
    );
    expect(harvests).toHaveLength(2);

    await page.goto(`/app/orchard/${tree.id}`);
    await page.getByRole('button', { name: /récoltes/i }).first().click();
    // 8,5 + 12 = 20,5 kg sur la saison — une somme, pas un remplacement.
    await expect(page.getByText(/20[.,]5\s*kg/)).toBeVisible();
  });

  test('ORCH-07 — deux unités ne sont jamais additionnées', async ({ page }) => {
    const tree = await createTree(page, `Noyer ${Date.now()}`, zone.id);
    const year = new Date().getFullYear();

    await createHarvest(page, {
      tree: tree.id, harvested_on: `${year}-09-01`, quantity: '12.000', unit: 'kg',
    });
    await createHarvest(page, {
      tree: tree.id, harvested_on: `${year}-09-02`, quantity: '40.000', unit: 'piece',
    });

    await page.goto(`/app/orchard/${tree.id}`);
    await page.getByRole('button', { name: /récoltes/i }).first().click();

    // Les deux totaux se lisent côte à côte. 52 de quoi que ce soit n'existe pas.
    const series = page.getByText(/12\s*kg/).first();
    await expect(series).toBeVisible();
    await expect(page.getByText(/40\s*pièces/).first()).toBeVisible();
    await expect(page.getByText(/\b52\b/)).toHaveCount(0);
  });

  test('ORCH-07 — une seule saison est annoncée comme telle, pas comme une tendance', async ({
    page,
  }) => {
    const tree = await createTree(page, `Figuier ${Date.now()}`, zone.id);
    const year = new Date().getFullYear();
    await createHarvest(page, {
      tree: tree.id, harvested_on: `${year}-09-01`, quantity: '5.000', unit: 'kg',
    });

    await page.goto(`/app/orchard/${tree.id}`);
    await expect(page.getByText(/une seule saison ne permet pas encore de comparaison/i))
      .toBeVisible();
  });
});
