import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E — Verger (parcours 30).
 *
 * Chaque test cite l'identifiant de la user story qu'il prouve
 * (`docs/USER_STORIES.md`). Le seed passe par l'API avec le JWT du navigateur,
 * puis le test pilote l'UI : la promesse est donc vérifiée **de l'écran jusqu'à
 * la base**, ce qu'aucun test unitaire ne fait.
 */

async function token(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

async function auth(page: Page): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await token(page)}`, 'Content-Type': 'application/json' };
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

async function createTree(
  page: Page,
  data: Record<string, unknown>,
): Promise<{ id: string; name: string }> {
  const resp = await page.request.post('/api/orchard/trees/', {
    headers: await auth(page),
    data,
  });
  if (!resp.ok())
    throw new Error(`création du sujet impossible : ${resp.status()} ${await resp.text()}`);
  return (await resp.json()) as { id: string; name: string };
}

test.describe('Verger', () => {
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

  test('ORCH-01 — créer un sujet depuis l\'écran, et le retrouver dans la liste', async ({
    page,
  }) => {
    const name = `Pommier ${Date.now()}`;

    await page.goto('/app/orchard');
    await page.getByRole('button', { name: /ajouter un sujet/i }).first().click();

    await page.getByLabel(/^Nom/).fill(name);
    await page.locator('#tree-zone').click();
    await page
      .getByRole('dialog', { name: 'Sélection de zones' })
      .getByRole('button', { name: zone.name, exact: true })
      .click();
    await page.getByLabel(/variété/i).fill('Reine des Reinettes');
    await page.getByRole('button', { name: /^enregistrer$/i }).click();

    // Écrit en base — pas seulement affiché : on relit par l'API.
    await expect(page.getByText(name)).toBeVisible();
    const trees = await listJson<{ name: string; zone: string }>(page, '/api/orchard/trees/');
    const created = trees.find((t) => t.name === name);
    expect(created).toBeTruthy();
    expect(created?.zone).toBe(zone.id);
  });

  test('ORCH-02 — un sujet sans zone est refusé, et l\'écran le dit', async ({ page }) => {
    await page.goto('/app/orchard');
    await page.getByRole('button', { name: /ajouter un sujet/i }).first().click();
    await page.getByLabel(/^Nom/).fill(`Orphelin ${Date.now()}`);
    await page.getByRole('button', { name: /^enregistrer$/i }).click();

    // Le formulaire refuse avant le réseau : un sujet sans endroit ne se retrouve pas.
    await expect(page.getByText(/choisis une zone/i)).toBeVisible();
  });

  test('ORCH-02 — supprimer une zone occupée est refusé en nommant ce qui bloque', async ({
    page,
  }) => {
    await createTree(page, { name: `Prunier ${Date.now()}`, zone_id: zone.id });

    // Le refus se prouve au niveau du contrat HTTP : 409, jamais 500 ni 204.
    const resp = await page.request.delete(`/api/zones/${zone.id}/`, {
      headers: await auth(page),
    });
    expect(resp.status()).toBe(409);
    const body = (await resp.json()) as { detail: string; protected_count: number };
    expect(body.protected_count).toBeGreaterThan(0);

    const zones = await listJson<{ id: string }>(page, '/api/zones/');
    expect(zones.some((z) => z.id === zone.id)).toBe(true);
  });

  test('ORCH-03 — consigner un entretien et le relire sur la fiche du sujet', async ({
    page,
  }) => {
    const tree = await createTree(page, { name: `Poirier ${Date.now()}`, zone_id: zone.id });
    const title = `Taille d'hiver ${Date.now()}`;

    await page.goto(`/app/orchard/${tree.id}`);
    await page.getByRole('button', { name: /entretien/i }).first().click();
    await page.getByRole('button', { name: /consigner un entretien/i }).first().click();

    await page.getByLabel(/^Intitulé/).fill(title);
    await page.getByRole('button', { name: /^enregistrer$/i }).click();

    await expect(page.getByText(title)).toBeVisible();
    const events = await listJson<{ title: string; tree: string }>(
      page,
      `/api/orchard/events/?tree=${tree.id}`,
    );
    expect(events.some((e) => e.title === title && e.tree === tree.id)).toBe(true);
  });

  test('ORCH-01 — un sujet arraché quitte la liste par défaut sans perdre son histoire', async ({
    page,
  }) => {
    const gone = await createTree(page, {
      name: `Cerisier ${Date.now()}`,
      zone_id: zone.id,
      status: 'removed',
    });

    await page.goto('/app/orchard');
    await expect(page.getByText(gone.name)).toHaveCount(0);

    await page.getByRole('button', { name: /^tous$/i }).click();
    await expect(page.getByText(gone.name)).toBeVisible();
  });
});
