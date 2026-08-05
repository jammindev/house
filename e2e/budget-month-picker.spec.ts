import { test, expect } from '@playwright/test';

/**
 * Le panneau Budgets se parcourt mois par mois (issue #516).
 *
 * Ce que seul un vrai navigateur atteste ici : le stepper est **branché** — la
 * flèche envoie bien un `?month=` au serveur, et ce que la page affiche ensuite
 * est la réponse pour *ce* mois. Un test unitaire vérifie la fonction de décalage
 * ; il ne dit rien du câblage hook → requête, qui est précisément ce qui manquait.
 *
 * Et le garde-fou du bord droit : la flèche « mois suivant » est désactivée sur
 * le mois en cours. Au-delà il n'y a rien à lire, et une flèche qui mène à des
 * écrans vides invite à un voyage sans fond.
 */

/** 'YYYY-MM' du mois en cours / du mois précédent, comme le front les calcule. */
function monthKey(delta = 0): string {
  const now = new Date();
  const total = now.getFullYear() * 12 + now.getMonth() + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Le libellé affiché par le stepper, en fr-FR (la locale du projet Playwright). */
function monthLabel(key: string): string {
  const [year, index] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
    new Date(year, index - 1, 1),
  );
}

test.describe('Budgets — navigation par mois', () => {
  test.beforeEach(async ({ page }) => {
    // La période est persistée en session : repartir du mois en cours, sinon un
    // test précédent décide de ce que celui-ci voit.
    await page.goto('/app/money/budgets');
    await page.evaluate(() => sessionStorage.removeItem('budget.period'));
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible();
  });

  test('le panneau ouvre sur le mois en cours', async ({ page }) => {
    await expect(page.getByRole('button', { name: monthLabel(monthKey()) })).toBeVisible();
  });

  test('la flèche « mois précédent » demande bien ce mois-là au serveur', async ({ page }) => {
    const previous = monthKey(-1);

    const request = page.waitForRequest(
      (req) => req.url().includes('/api/budget/budgets/overview/')
        && req.url().includes(`month=${previous}`),
    );
    await page.getByRole('button', { name: 'Mois précédent' }).click();
    await request;

    await expect(page.getByRole('button', { name: monthLabel(previous) })).toBeVisible();
  });

  test('on remonte plusieurs mois d’affilée, sans sauter de cran', async ({ page }) => {
    const back = page.getByRole('button', { name: 'Mois précédent' });
    await back.click();
    await back.click();
    await back.click();

    await expect(page.getByRole('button', { name: monthLabel(monthKey(-3)) })).toBeVisible();
  });

  test('« mois suivant » est fermé sur le mois en cours, et rouvre dès qu’on recule', async ({
    page,
  }) => {
    const forward = page.getByRole('button', { name: 'Mois suivant' });
    await expect(forward).toBeDisabled();

    await page.getByRole('button', { name: 'Mois précédent' }).click();
    await expect(forward).toBeEnabled();

    await forward.click();
    await expect(page.getByRole('button', { name: monthLabel(monthKey()) })).toBeVisible();
    await expect(forward).toBeDisabled();
  });

  test('le mois choisi survit à un rechargement de la page', async ({ page }) => {
    await page.getByRole('button', { name: 'Mois précédent' }).click();
    await expect(page.getByRole('button', { name: monthLabel(monthKey(-1)) })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: monthLabel(monthKey(-1)) })).toBeVisible();
  });

  test('le panneau offre le sélecteur entier, comme les dépenses', async ({ page }) => {
    for (const label of ['30 derniers jours', 'Cette année', 'Personnalisé']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('« cette année » interroge l’année, et non un mois', async ({ page }) => {
    const year = new Date().getFullYear();

    const request = page.waitForRequest(
      (req) => req.url().includes('/api/budget/budgets/overview/')
        && req.url().includes(`from=${year}-01-01`)
        && req.url().includes(`to=${year}-12-31`),
    );
    await page.getByRole('button', { name: 'Cette année' }).click();
    await request;
  });

  test('« personnalisé » ouvre les deux champs de dates', async ({ page }) => {
    await page.getByRole('button', { name: 'Personnalisé' }).click();

    await expect(page.locator('#budget-panel-from')).toBeVisible();
    await expect(page.locator('#budget-panel-to')).toBeVisible();
  });
});

/**
 * ⚠️ Le plafond est **mensuel** : hors mois entier il n'a pas d'échelle en face.
 *
 * Sur « cette année », comparer douze mois de dépenses à « 400 € / mois »
 * afficherait « 4 200 € / 400 € » et une barre rouge saturée sur une enveloppe
 * parfaitement tenue — un dépassement qui n'existe pas. Le serveur retire donc
 * le plafond (`amount: null`, état `uncapped`) et la carte n'affiche plus que le
 * dépensé, exactement comme pour une enveloppe suivie sans plafond.
 */
test.describe('Budgets — le plafond ne se compare qu’à un mois', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/money/budgets');
    await page.evaluate(() => sessionStorage.removeItem('budget.period'));
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible();
  });

  test('la barre de progression disparaît sur une fenêtre qui n’est pas un mois', async ({
    page,
  }) => {
    // Sur le mois en cours, les enveloppes plafonnées ont leur barre.
    const monthBars = await page.getByRole('progressbar').count();
    test.skip(monthBars === 0, 'aucun budget plafonné dans le jeu de données');

    await page.getByRole('button', { name: 'Cette année' }).click();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
  });

  test('revenir sur un mois rend les plafonds', async ({ page }) => {
    const monthBars = await page.getByRole('progressbar').count();
    test.skip(monthBars === 0, 'aucun budget plafonné dans le jeu de données');

    await page.getByRole('button', { name: 'Cette année' }).click();
    await expect(page.getByRole('progressbar')).toHaveCount(0);

    await page.getByRole('button', { name: 'Mois précédent' }).click();
    await expect(page.getByRole('progressbar')).toHaveCount(monthBars);
  });
});
