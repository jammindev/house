import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E — Recherche globale (palette de la top bar).
 *
 * Aucun appel LLM : `/api/search/` est du plein texte Postgres. Ce qui se vérifie
 * ici et nulle part ailleurs, c'est la chaîne complète — la palette s'ouvre depuis
 * la barre du haut *et* au clavier, la frappe atteint le réseau (debounce), et un
 * résultat **mène à sa page**. Un test unitaire sur le groupement ne dit rien de ces
 * quatre maillons.
 *
 * Seed : un projet créé par l'API avec un titre unique par test, supprimé ensuite.
 * Le titre porte un mot rare (`Kryptonite`) pour ne dépendre d'aucune donnée de
 * démo et ne jamais se noyer dans les résultats.
 */

interface Project {
  id: string;
  title: string;
}

async function getAccessToken(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

async function createProject(page: Page, title: string): Promise<Project> {
  const token = await getAccessToken(page);
  const resp = await page.request.post('/api/projects/projects/', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { title, status: 'active', type: 'other', priority: 3 },
  });
  if (!resp.ok()) {
    throw new Error(`Impossible de créer le projet "${title}" : ${resp.status()}`);
  }
  return (await resp.json()) as Project;
}

async function deleteProject(page: Page, projectId: string): Promise<void> {
  const token = await getAccessToken(page);
  await page.request.delete(`/api/projects/projects/${projectId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe('Recherche globale', () => {
  let project: Project;
  let needle: string;

  test.beforeEach(async ({ page }) => {
    // Hydrater le JWT avant d'appeler l'API.
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/app\/dashboard/);

    needle = `Kryptonite${Date.now()}`;
    project = await createProject(page, `Chantier ${needle}`);
    // Recharger : la palette est montée dans la coque, la donnée doit exister
    // avant la première requête de recherche.
    await page.reload();
  });

  test.afterEach(async ({ page }) => {
    if (project?.id) await deleteProject(page, project.id);
  });

  test('trouve un projet depuis la barre du haut et mène à sa page', async ({ page }) => {
    await page.getByTestId('global-search-trigger').click();

    const input = page.getByTestId('global-search-input');
    await expect(input).toBeFocused();
    await input.fill(needle);

    const result = page.getByTestId('global-search-result').filter({ hasText: needle });
    await expect(result.first()).toBeVisible();

    await result.first().click();
    await expect(page).toHaveURL(new RegExp(`/app/projects/${project.id}`));
  });

  test('le raccourci clavier ouvre la palette depuis n’importe quelle page', async ({ page }) => {
    await page.goto('/app/tasks');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByTestId('global-search-input')).toBeVisible();
  });

  test('les flèches et Entrée suffisent — sans toucher la souris', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByTestId('global-search-input').fill(needle);
    await expect(page.getByTestId('global-search-result').first()).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/app\//);
    // La palette se ferme en naviguant : elle ne doit pas rester par-dessus la page.
    await expect(page.getByTestId('global-search-input')).toBeHidden();
  });

  test('une frappe trop courte ne cherche rien', async ({ page }) => {
    await page.getByTestId('global-search-trigger').click();
    await page.getByTestId('global-search-input').fill('K');
    await expect(page.getByTestId('global-search-result')).toHaveCount(0);
  });

  test('un terme absent affiche une absence de résultat, pas une erreur', async ({ page }) => {
    await page.getByTestId('global-search-trigger').click();
    await page.getByTestId('global-search-input').fill('zzzzintrouvable');
    await expect(page.getByText('Aucun résultat.')).toBeVisible();
  });

  /**
   * La recherche répond en deux temps : le mot-clé tout de suite, le sens ensuite.
   * C'est la seule garantie qui ne se teste qu'ici — en jsdom rien ne dit qu'un
   * `await` de trop n'a pas remis les deux appels en série. On retarde donc l'étape
   * sémantique de 1,5 s et on exige que le résultat lexical soit déjà à l'écran.
   */
  test("l'étape par le sens n'attend jamais l'étape mot-clé", async ({ page }) => {
    const fabricated = {
      entity_type: 'document',
      object_id: '00000000-0000-0000-0000-000000000001',
      label: 'Devis trouvé par le sens',
      url: '/app/documents/00000000-0000-0000-0000-000000000001',
      snippet: 'Chaudière à remplacer',
    };

    await page.route(/\/api\/search\/\?.*semantic=1/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [fabricated] }),
      });
    });

    await page.getByTestId('global-search-trigger').click();
    await page.getByTestId('global-search-input').fill(needle);

    // Le résultat lexical est là bien avant que le sens ait répondu.
    await expect(page.getByTestId('global-search-result').filter({ hasText: needle })).toBeVisible({
      timeout: 1000,
    });
    await expect(page.getByTestId('global-search-sense-group')).toBeHidden();

    // Puis le groupe « Par le sens » s'ajoute, sans déplacer ce qui précède.
    await expect(page.getByTestId('global-search-sense-group')).toBeVisible({ timeout: 4000 });
    await expect(page.getByText('Devis trouvé par le sens')).toBeVisible();
  });

  test('un échec de l’étape par le sens ne casse pas la recherche', async ({ page }) => {
    await page.route(/\/api\/search\/\?.*semantic=1/, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"nope"}' }),
    );

    await page.getByTestId('global-search-trigger').click();
    await page.getByTestId('global-search-input').fill(needle);

    // Les résultats mot-clé restent une réponse complète : aucune erreur affichée.
    await expect(page.getByTestId('global-search-result').filter({ hasText: needle })).toBeVisible();
    await expect(page.getByTestId('global-search-sense-group')).toBeHidden();
  });
});
