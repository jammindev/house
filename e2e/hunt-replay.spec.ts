import { test, expect, type Page } from '@playwright/test';

/**
 * Rejouer une chasse terminée — parcours 31, lot 4 (issue #611).
 *
 * Ce que seul un vrai navigateur atteste : **le bouton n'existe qu'au bon
 * moment**. « Rejouer » sur un brouillon n'a rien à ressortir, sur une partie en
 * cours il faudrait d'abord la terminer — et un bouton qui ne peut rien faire
 * fait douter de tous les autres.
 *
 * Le ping du samedi pluvieux n'est pas ici : il n'a aucune surface navigateur, et
 * ses quatre conditions se testent une par une côté serveur
 * (`apps/games/tests/test_replay_and_ping.py`).
 *
 * Couvre `CHAS-13`.
 */

interface Label {
  zone_id: string;
  name: string;
  path: string;
}

interface Hunt {
  id: string;
  name: string;
  status: string;
  steps: { zone: string; riddle: string }[];
}

async function token(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

async function auth(page: Page): Promise<{ Authorization: string }> {
  return { Authorization: `Bearer ${await token(page)}` };
}

async function labels(page: Page): Promise<Label[]> {
  const response = await page.request.get('/api/zones/print-sheet/', {
    headers: await auth(page),
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { labels: Label[] }).labels;
}

async function hunts(page: Page): Promise<Hunt[]> {
  const response = await page.request.get('/api/games/hunts/', { headers: await auth(page) });
  const body = (await response.json()) as unknown;
  return (Array.isArray(body) ? body : ((body as { results?: unknown[] }).results ?? [])) as Hunt[];
}

/** Repart d'un foyer sans chasse : les specs partagent une base non réinitialisée. */
async function clearHunts(page: Page): Promise<void> {
  const headers = await auth(page);
  for (const hunt of await hunts(page)) {
    await page.request.delete(`/api/games/hunts/${hunt.id}/`, { headers });
  }
}

async function seedHunt(page: Page, rooms: Label[], name: string): Promise<string> {
  const response = await page.request.post('/api/games/hunts/', {
    headers: await auth(page),
    data: {
      name,
      treasure_text: 'Dans la boîte à biscuits',
      steps: rooms.map((room, index) => ({ zone: room.zone_id, riddle: `Énigme ${index}` })),
    },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

test.describe('Rejouer une chasse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/games');
    await clearHunts(page);
  });

  /** Une chasse laissée active détourne les scans du foyer — voir `hunt.spec.ts`. */
  test.afterEach(async ({ page }) => {
    await clearHunts(page);
  });

  test('CHAS-13 — une chasse terminée se ressort mélangée, sans toucher l\'originale', async ({
    page,
  }) => {
    const rooms = (await labels(page)).slice(0, 4);
    await seedHunt(page, rooms, 'Chasse à rejouer');

    // On la joue jusqu'au bout : « Rejouer » ne s'offre qu'à une chasse finie.
    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Lancer' }).first().click();
    await expect(page).toHaveURL(/\/app\/games\/play/);
    for (const [index, room] of rooms.entries()) {
      await page.goto(room.path);
      // ⚠️ Attendre l'**avancement**, pas l'URL : elle vaut déjà `/play` au tour
      // précédent, donc l'assertion passerait sans rien attendre — et la
      // navigation suivante couperait le scan en vol. Le compteur, lui, ne
      // bouge qu'une fois la réponse du serveur arrivée.
      const remaining = rooms.length - index - 1;
      if (remaining > 0) {
        await expect(
          page.getByText(`${index + 1} sur ${rooms.length} trouvées`),
        ).toBeVisible();
      }
    }
    await expect(page.getByText('Trouvé !')).toBeVisible();

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Rejouer' }).first().click();

    // Deux chasses désormais : la jouée, et un brouillon prêt à repartir.
    await expect(page.getByRole('button', { name: 'Lancer' })).toHaveCount(1);

    const all = await hunts(page);
    expect(all).toHaveLength(2);
    const original = all.find((h) => h.status === 'done') as Hunt;
    const copy = all.find((h) => h.status === 'draft') as Hunt;

    expect(copy.name).toBe(original.name);
    // L'originale garde son ordre **et** son statut : c'est la seule trace que
    // le foyer a joué, et un « rejouer » qui l'effacerait ne se verrait
    // qu'après.
    expect(original.steps.map((s) => s.zone)).toEqual(
      rooms.map((room) => room.zone_id),
    );
    expect(copy.steps.map((s) => s.zone)).not.toEqual(original.steps.map((s) => s.zone));
    expect(new Set(copy.steps.map((s) => s.zone))).toEqual(
      new Set(original.steps.map((s) => s.zone)),
    );
  });

  test('CHAS-13 — « Rejouer » ne s\'offre pas sur un brouillon', async ({ page }) => {
    const rooms = (await labels(page)).slice(0, 2);
    await seedHunt(page, rooms, 'Brouillon jamais joué');

    await page.goto('/app/games');

    await expect(page.getByRole('button', { name: 'Lancer' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Rejouer' })).toHaveCount(0);
  });

  test('CHAS-13 — le brouillon ressorti repart avec ses énigmes', async ({ page }) => {
    const rooms = (await labels(page)).slice(0, 3);
    const id = await seedHunt(page, rooms, 'Chasse de l\'an dernier');

    // Terminée par l'API : le parcours de jeu a déjà sa spec, on teste le rejeu.
    await page.request.post(`/api/games/hunts/${id}/start/`, { headers: await auth(page) });
    for (const room of rooms) {
      await page.request.post('/api/zones/scan/', {
        headers: await auth(page),
        data: { token: room.path.split('/').pop() },
      });
    }

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Rejouer' }).first().click();

    // Le point du lot : ressortir **sans tout ressaisir**. La preuve n'est pas
    // que la copie existe, c'est qu'elle **se joue** — donc que les énigmes ont
    // suivi. On la lance, et la première énigme affichée est bien l'une de
    // celles de l'an dernier (pas forcément la première : l'ordre a changé,
    // c'est tout l'intérêt).
    await page.getByRole('button', { name: 'Lancer' }).first().click();

    await expect(page).toHaveURL(/\/app\/games\/play/);
    await expect(page.getByText(/^Énigme [0-2]$/)).toBeVisible();
    await expect(page.getByText('0 sur 3 trouvées')).toBeVisible();
  });
});
