import { test, expect, type Page } from '@playwright/test';

/**
 * Les énigmes proposées par l'assistant — parcours 31, lot 3 (issue #610).
 *
 * Ce que seul un vrai navigateur atteste : **ce que l'écran promet**. Le serveur
 * peut refuser proprement en 503 nommé et l'interface promettre quand même — le
 * défaut que tout le registre des capacités existe pour supprimer ne se voit
 * qu'à l'écran, jamais dans une réponse HTTP.
 *
 * Les deux capacités sont **stubées** (`page.route`), et c'est délibéré : la
 * question posée ici est « que fait l'écran quand l'instance a la clé / ne l'a
 * pas », pas « le fournisseur répond-il ». Un test qui dépendrait d'une vraie
 * clé serait vert chez l'auteur, rouge en CI, et ne dirait rien des deux cas.
 *
 * Couvre `CHAS-11` et `CHAS-12`.
 */

const RIDDLES_URL = '**/api/games/hunts/generate-riddles/';

async function token(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
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

/**
 * Fait dire au serveur que la capacité est là — ou qu'elle manque.
 *
 * On réécrit la **réponse réelle** plutôt que d'en inventer une : le reste de
 * l'application lit la même liste (l'assistant, le push, l'e-mail), et une
 * réponse fabriquée de toutes pièces éteindrait des écrans sans rapport.
 */
async function setRiddleCapability(page: Page, available: boolean): Promise<void> {
  await page.route('**/api/capabilities/', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      capabilities: { key: string; available: boolean }[];
    };
    body.capabilities = body.capabilities.map((row) =>
      row.key === 'hunt_riddles' ? { ...row, available } : row,
    );
    await route.fulfill({ response, json: body });
  });
}

/** Choisit une pièce dans le ZonePicker de l'étape `index`. */
async function pickRoom(page: Page, index: number, nth: number): Promise<void> {
  const dialog = page.getByRole('dialog').first();
  await dialog.locator(`#hunt-step-zone-${index}`).click();
  const picker = page.getByRole('dialog', { name: 'Sélection de zones' });
  await picker.getByRole('button').nth(nth).click();
}

test.describe('Énigmes de chasse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/games');
    await clearHunts(page);
  });

  /**
   * Une chasse laissée active détourne les scans du foyer — voir `hunt.spec.ts`.
   *
   * `unrouteAll` d'abord : sans lui, une requête encore en vol au moment où la
   * page se ferme fait échouer le *callback de route*, donc le test — un rouge
   * qui ne dit rien de l'application. Le ménage lui-même passe par
   * `page.request`, qui ne traverse pas les routes et n'a pas besoin de naviguer.
   */
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await clearHunts(page);
  });

  test('CHAS-11 — proposer des énigmes, les relire, les corriger', async ({ page }) => {
    await setRiddleCapability(page, true);
    await page.route(RIDDLES_URL, async (route) => {
      const sent = route.request().postDataJSON() as { zones: string[]; age: string };
      await route.fulfill({
        json: {
          riddles: sent.zones.map((zone, index) => ({
            index,
            zone,
            riddle: `Énigme proposée ${index}`,
          })),
        },
      });
    });

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Nouvelle chasse' }).first().click();

    const dialog = page.getByRole('dialog').first();
    await dialog.getByLabel('Nom').fill('Chasse écrite par l’assistant');
    await dialog.getByLabel('Le trésor').fill('Dans le tiroir à couverts');
    await pickRoom(page, 0, 1);
    await pickRoom(page, 1, 2);

    await dialog.getByRole('button', { name: 'Proposer des énigmes' }).click();

    // Les deux champs se remplissent — et restent des champs.
    const first = dialog.getByLabel(/Énigme de l.étape 1/);
    const second = dialog.getByLabel(/Énigme de l.étape 2/);
    await expect(first).toHaveValue('Énigme proposée 0');
    await expect(second).toHaveValue('Énigme proposée 1');

    // La relecture n'est pas décorative : ce qui part en base est le texte
    // corrigé, pas celui du modèle.
    await first.fill('Là où l’eau chante le matin');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Chasse écrite par l’assistant')).toBeVisible();

    const stored = await page.request.get('/api/games/hunts/', {
      headers: { Authorization: `Bearer ${await token(page)}` },
    });
    const body = (await stored.json()) as unknown;
    const hunts = (Array.isArray(body) ? body : ((body as { results?: unknown[] }).results ?? [])) as {
      steps: { riddle: string }[];
    }[];
    expect(hunts[0].steps.map((step) => step.riddle)).toEqual([
      'Là où l’eau chante le matin',
      'Énigme proposée 1',
    ]);
  });

  test('CHAS-11 — une réponse illisible ne remplit rien et se dit', async ({ page }) => {
    await setRiddleCapability(page, true);
    await page.route(RIDDLES_URL, (route) =>
      route.fulfill({ status: 502, json: { detail: 'The model did not answer with valid JSON.' } }),
    );

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Nouvelle chasse' }).first().click();

    const dialog = page.getByRole('dialog').first();
    await dialog.getByLabel('Nom').fill('Chasse ratée');
    await pickRoom(page, 0, 1);

    await dialog.getByRole('button', { name: 'Proposer des énigmes' }).click();

    // Le champ reste vide — un demi-remplissage se lirait plus mal que rien —
    // et le dialog reste ouvert : on peut écrire à la main dans la foulée.
    await expect(dialog.getByLabel(/Énigme de l.étape 1/)).toHaveValue('');
    await expect(dialog.getByRole('button', { name: 'Proposer des énigmes' })).toBeEnabled();
  });

  test('CHAS-12 — sans clé, l\'écran ne propose rien et la saisie manuelle suffit', async ({
    page,
  }) => {
    await setRiddleCapability(page, false);

    // Si l'écran appelait quand même, on le saurait ici : la route n'est
    // atteinte par personne, et un bouton grisé n'en serait pas moins un
    // mensonge — c'est l'absence qu'on vérifie, pas le refus.
    let called = false;
    await page.route(RIDDLES_URL, (route) => {
      called = true;
      return route.fulfill({ status: 503, json: { detail: 'unavailable' } });
    });

    await page.goto('/app/games');
    await page.getByRole('button', { name: 'Nouvelle chasse' }).first().click();

    const dialog = page.getByRole('dialog').first();
    await expect(dialog.getByRole('button', { name: 'Proposer des énigmes' })).toHaveCount(0);

    await dialog.getByLabel('Nom').fill('Chasse à la main');
    await dialog.getByLabel('Le trésor').fill('Sous l’oreiller');
    await dialog.getByLabel(/Énigme de l.étape 1/).fill('Je suis là où l’on dort');
    await pickRoom(page, 0, 1);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByText('Chasse à la main')).toBeVisible();

    // Et elle se joue : le repli manuel n'est pas un mode dégradé.
    await page.getByRole('button', { name: 'Lancer' }).first().click();
    await expect(page).toHaveURL(/\/app\/games\/play/);
    await expect(page.getByText('Je suis là où l’on dort')).toBeVisible();

    expect(called).toBe(false);
  });
});
