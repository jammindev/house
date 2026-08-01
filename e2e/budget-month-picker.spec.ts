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
    await page.goto('/app/money?tab=budgets');
    await page.evaluate(() => sessionStorage.removeItem('budget.period'));
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Argent' })).toBeVisible();
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

  test('aucune fenêtre libre n’est offerte ici — un plafond mensuel n’a rien à y comparer', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: 'Cette année' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '30 derniers jours' })).toHaveCount(0);
    // …alors que le journal des dépenses, lui, les propose toujours.
    await page.goto('/app/money?tab=expenses');
    await expect(page.getByRole('button', { name: 'Cette année' })).toBeVisible();
  });
});
