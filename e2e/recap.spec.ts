import { test, expect, type Page } from '@playwright/test';

/**
 * Parcours 27 — Lot 4 : la story du récap mensuel.
 *
 * Couvre :
 *  1. Entrée sidebar « Récap » → /app/recap
 *  2. Historique : le mois frais en tête, les mois passés en liste sobre
 *  3. Navigation carte par carte : boutons, pastilles, clavier ←/→
 *  4. Sortie explicite (Échap, bouton Terminé) → retour à l'historique
 *  5. Un mois sans rien à raconter le dit, au lieu d'afficher un vide
 *
 * **Pourquoi les réponses sont simulées ici.** Un instantané de récap est gelé une
 * fois puis jamais recalculé — c'est tout l'intérêt du modèle. Un test qui sème des
 * dépenses puis demande le récap dépend donc de l'ordre d'exécution : au deuxième
 * run, le mois est déjà figé (vide) et rien ne peut plus le remplir. La génération
 * est couverte côté serveur (`apps/recap/tests/`, dont l'accord avec le
 * `BudgetReport` et l'idempotence du gel) ; ce qui se vérifie ici, et nulle part
 * ailleurs, c'est le **parcours de la story**.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MONTH = '2026-06';

function card(kind: string, value: string, headline: string, caption: string) {
  return { kind, emoji: '💰', headline, value, value_type: 'raw' as const, caption };
}

const RECAP = {
  id: '11111111-1111-1111-1111-111111111111',
  month: MONTH,
  card_count: 3,
  chapters: [
    {
      key: 'money',
      emoji: '💰',
      title: 'Argent',
      cards: [
        card('total_spent', '204', 'dépensés', "Soit 12 % de moins que le mois précédent."),
        card('budget_outcome', '2/3', 'budgets tenus', 'Dépassement : Courses.'),
        card('biggest_expense', '180', 'Plombier', 'Votre plus grosse dépense du mois.'),
      ],
    },
  ],
  created_at: '2026-07-01T09:00:00Z',
};

const OLDER = { ...RECAP, id: '22222222-2222-2222-2222-222222222222', month: '2026-05' };

/** Sert le récap simulé sur les trois routes que le front interroge. */
async function stubRecap(page: Page): Promise<void> {
  await page.route('**/api/recap/latest/', (route) =>
    route.fulfill({ json: RECAP }),
  );
  await page.route(`**/api/recap/${MONTH}/`, (route) => route.fulfill({ json: RECAP }));
  await page.route('**/api/recap/', (route) => route.fulfill({ json: [RECAP, OLDER] }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Récap mensuel', () => {
  test('la sidebar mène à la page Récap', async ({ page }) => {
    await page.goto('/app/dashboard');
    await page.getByRole('link', { name: /Récap/i }).first().click();

    await expect(page).toHaveURL(/\/app\/recap$/);
    await expect(page.getByRole('heading', { name: /Récap/i })).toBeVisible();
  });

  test("l'historique met le mois frais en tête et liste les précédents", async ({ page }) => {
    await stubRecap(page);
    await page.goto('/app/recap');

    await expect(page.getByText(/Voir le récap/i)).toBeVisible();
    await expect(page.getByText('3 cartes').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Mois précédents/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /mai 2026/i })).toBeVisible();
  });

  test('la story se parcourt carte par carte, puis se referme', async ({ page }) => {
    await stubRecap(page);
    await page.goto('/app/recap');

    await page.getByText(/Voir le récap/i).click();
    await expect(page).toHaveURL(new RegExp(`/app/recap/${MONTH}$`));

    // Première carte : le gros chiffre et sa légende sont là.
    await expect(page.getByLabel('Carte 1 sur 3').first()).toBeVisible();
    await expect(page.getByText('Soit 12 % de moins que le mois précédent.')).toBeVisible();

    // Avancer au bouton…
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByLabel('Carte 2 sur 3').first()).toBeVisible();
    await expect(page.getByText('Dépassement : Courses.')).toBeVisible();

    // …puis au clavier, dans les deux sens.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByLabel('Carte 3 sur 3').first()).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByLabel('Carte 2 sur 3').first()).toBeVisible();

    // Une pastille ramène directement à une carte donnée.
    await page.getByRole('button', { name: 'Aller à la carte 1' }).click();
    await expect(page.getByLabel('Carte 1 sur 3').first()).toBeVisible();

    // La dernière carte propose de sortir plutôt que d'avancer dans le vide.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Terminé' })).toBeVisible();

    // Échap sort de la story — une story ne doit jamais piéger.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/app\/recap$/);
  });

  test('le bouton Terminé ramène à l\'historique', async ({ page }) => {
    await stubRecap(page);
    await page.goto(`/app/recap/${MONTH}`);

    await page.getByRole('button', { name: 'Aller à la carte 3' }).click();
    await page.getByRole('button', { name: 'Terminé' }).click();

    await expect(page).toHaveURL(/\/app\/recap$/);
  });

  test('le récap frais se trouve sans être cherché, et se ferme', async ({ page }) => {
    await stubRecap(page);
    await page.goto('/app/dashboard');

    const teaser = page.getByText(/3 tarjetas|3 cartes te|3 cartes vous attendent/i);
    await expect(teaser).toBeVisible();

    // Fermer la carte la retire pour ce mois — sans toucher au récap lui-même.
    await page.getByRole('button', { name: 'Fermer' }).first().click();
    await expect(teaser).toHaveCount(0);

    await page.goto('/app/recap');
    await expect(page.getByText(/Voir le récap/i)).toBeVisible();
  });

  test('les chapitres se coupent depuis la page Récap', async ({ page }) => {
    await stubRecap(page);
    await page.goto('/app/recap');

    // `CardTitle` rend un div, pas un heading — d'où le getByText.
    await expect(page.getByText('Chapitres', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Argent', { exact: true })).toBeChecked();
  });

  test('un mois sans rien à raconter ne prétend pas le contraire', async ({ page }) => {
    // Un mois jamais gelé n'existe pas : la story le dit au lieu d'afficher un vide.
    await page.goto('/app/recap/2019-01');

    await expect(page.getByText(/Rien à raconter pour ce mois/i)).toBeVisible();
    await page.getByRole('button', { name: /Retour aux récaps/i }).click();
    await expect(page).toHaveURL(/\/app\/recap$/);
  });
});
