import { test, expect, type Page } from '@playwright/test';

/**
 * La chasse au trésor — parcours 31, lot 2 (issue #609).
 *
 * Ce que seul un vrai navigateur atteste : une partie **se joue par navigation
 * directe** sur l'URL d'une étiquette, exactement comme le fait l'appareil photo
 * d'un téléphone qui passe de main en main. L'état ne vit dans aucun onglet — et
 * c'est ce que le rechargement, ici, vérifie.
 *
 * Couvre `CHAS-04` à `CHAS-10`.
 */

interface Label {
  zone_id: string;
  name: string;
  path: string;
}

async function token(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

async function labels(page: Page): Promise<Label[]> {
  const response = await page.request.get('/api/zones/print-sheet/', {
    headers: { Authorization: `Bearer ${await token(page)}` },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { labels: Label[] }).labels;
}

/** Repart d'un foyer sans chasse : les specs partagent une base non réinitialisée. */
async function clearHunts(page: Page): Promise<void> {
  const auth = { Authorization: `Bearer ${await token(page)}` };
  const response = await page.request.get('/api/games/hunts/', { headers: auth });
  if (!response.ok()) return;
  const body = (await response.json()) as unknown;
  const items = (Array.isArray(body) ? body : ((body as { results?: unknown[] }).results ?? [])) as {
    id: string;
  }[];
  for (const hunt of items) {
    await page.request.delete(`/api/games/hunts/${hunt.id}/`, { headers: auth });
  }
}

/** Crée une chasse par l'API — la composition à l'écran a sa propre spec. */
async function seedHunt(page: Page, rooms: Label[], treasure: string): Promise<string> {
  const response = await page.request.post('/api/games/hunts/', {
    headers: { Authorization: `Bearer ${await token(page)}` },
    data: {
      name: 'Chasse E2E',
      treasure_text: treasure,
      steps: rooms.map((room, index) => ({ zone: room.zone_id, riddle: `Énigme ${index}` })),
    },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

test.describe('Chasse au trésor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/games');
    await clearHunts(page);
  });

  test('CHAS-04 — composer une chasse depuis l\'écran', async ({ page }) => {
    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Nouvelle chasse' }).first().click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom').fill('Chasse du dimanche');
    await dialog.getByLabel('Le trésor').fill('Dans le four éteint');

    // Deux étapes vides sont proposées d'emblée : on renseigne la première.
    // Regex : le catalogue utilise l'apostrophe typographique (’), pas la droite.
    await dialog.getByLabel(/Énigme de l.étape 1/).fill('Là où l’eau chante');

    // Le ZonePicker est un bouton qui ouvre un panneau `role="dialog"` dont les
    // entrées sont des <button> — pas un <select>, donc pas de `getByRole('option')`.
    await dialog.locator('#hunt-step-zone-0').click();
    const picker = page.getByRole('dialog', { name: 'Sélection de zones' });
    await picker.getByRole('button').nth(1).click();

    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Chasse du dimanche')).toBeVisible();
  });

  test('CHAS-05, CHAS-06, CHAS-08 — lancer, avancer par scan, révéler le trésor', async ({
    page,
  }) => {
    const rooms = (await labels(page)).slice(0, 2);
    await seedHunt(page, rooms, 'Dans la boîte à biscuits');

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Lancer' }).first().click();

    await expect(page).toHaveURL(/\/app\/games\/play/);
    await expect(page.getByText('Énigme 0')).toBeVisible();
    // Le trésor n'est nulle part avant la fin.
    await expect(page.getByText('biscuits')).toHaveCount(0);

    // Premier scan : navigation directe, comme l'appareil photo.
    await page.goto(rooms[0].path);
    await expect(page).toHaveURL(/\/app\/games\/play/);
    await expect(page.getByText('Énigme 1')).toBeVisible();

    // Dernier scan : le trésor apparaît.
    await page.goto(rooms[1].path);
    await expect(page).toHaveURL(/\/app\/games\/play/);
    await expect(page.getByText('Trouvé !')).toBeVisible();
    await expect(page.getByText('Dans la boîte à biscuits')).toBeVisible();
  });

  test('CHAS-07 — une mauvaise pièce n\'avance pas et ne révèle rien', async ({ page }) => {
    const all = await labels(page);
    const rooms = all.slice(0, 2);
    const outsider = all[2];
    await seedHunt(page, rooms, 'Sous le coussin');

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Lancer' }).first().click();
    await expect(page.getByText('Énigme 0')).toBeVisible();

    await page.goto(outsider.path);

    await expect(page).toHaveURL(/\/app\/games\/play/);
    // Toujours la même énigme : rien n'a bougé, et rien n'a été dévoilé.
    await expect(page.getByText('Énigme 0')).toBeVisible();
    await expect(page.getByText('Énigme 1')).toHaveCount(0);
    await expect(page.getByText('Sous le coussin')).toHaveCount(0);
  });

  test('CHAS-09 — la partie survit à un rechargement complet', async ({ page }) => {
    const rooms = (await labels(page)).slice(0, 3);
    await seedHunt(page, rooms, 'Derrière les livres');

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Lancer' }).first().click();
    await page.goto(rooms[0].path);
    await expect(page.getByText('Énigme 1')).toBeVisible();

    await page.reload();

    await expect(page.getByText('Énigme 1')).toBeVisible();
    await expect(page.getByText('1 sur 3 trouvées')).toBeVisible();
  });

  test('CHAS-10 — une seule chasse active à la fois', async ({ page }) => {
    const rooms = (await labels(page)).slice(0, 2);
    await seedHunt(page, rooms, 'Trésor A');
    await seedHunt(page, rooms, 'Trésor B');

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Lancer' }).first().click();
    await expect(page).toHaveURL(/\/app\/games\/play/);

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Lancer' }).first().click();

    // On reste sur la liste : la seconde n'a pas démarré. Assertion d'**état**
    // et non de toast — un toast s'auto-efface, et le test devient alors une
    // course entre son délai et celui de Playwright.
    await expect(page).toHaveURL(/\/app\/games$/);
    await expect(page.getByRole('button', { name: 'Lancer' })).toHaveCount(1);
  });
});
