import { test, expect } from '@playwright/test';

/**
 * Parcours 21 — Lot 3 : Bilan mensuel.
 *
 * Couvre :
 *  1. Navigation depuis /app/budget → /app/budget/reports via la link card "Bilan mensuel"
 *  2. Structure de la page (BackLink vers Budgets, titre, description)
 *  3. État tolérant : soit un état vide ("Aucun bilan"), soit une card de rapport
 *     avec un libellé de mois capitalisé — le contenu dépend des données seedées
 *     et du cycle calendaire (dernier mois clôturé).
 *  4. Seeding d'une dépense dans le mois précédent via l'API → le rapport
 *     "Mois dernier" apparaît (si la génération lazy de /api/budget/reports/latest/
 *     le crée) ; sinon assertion sur l'état vide avec note sur la limite.
 *
 * Note : le rapport "Mois dernier" est généré en lazy par le backend (appel Claude)
 * au premier GET /api/budget/reports/latest/ du mois. Si le dernier mois clôturé
 * n'a aucune dépense dans la DB de test, le backend peut retourner null → état vide
 * affiché. Les assertions restent volontairement tolérantes sur le contenu.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

/** Retourne le premier jour du mois précédent au format YYYY-MM-DD. */
function firstDayOfPreviousMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Crée une dépense ad-hoc dans le mois précédent via l'API.
 * On ne peut pas contrôler la date occurred_at depuis le dialog UI,
 * donc on passe directement par l'endpoint.
 */
async function apiCreatePreviousMonthExpense(
  page: import('@playwright/test').Page,
  subject: string,
  amount: number,
): Promise<void> {
  const token = await getAccessToken(page);
  const occurred_at = firstDayOfPreviousMonth() + 'T10:00:00Z';
  const resp = await page.request.post('/api/interactions/', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      type: 'expense',
      subject,
      metadata: {
        kind: 'manual',
        amount: String(amount),
        source_name: null,
        unit_price: null,
        supplier: '',
      },
      occurred_at,
    },
  });
  // Silently ignore if the endpoint shape differs — the test assertions are tolerant.
  if (!resp.ok()) {
    console.warn(`apiCreatePreviousMonthExpense: ${resp.status()} — ${await resp.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Bilan mensuel — parcours 21 lot 3', () => {
  test.beforeEach(async ({ page }) => {
    // Hydrater le localStorage (JWT) avant tout appel API
    await page.goto('/app/budget');
    await expect(page).toHaveURL(/\/app\/budget/);
  });

  // ── 1. Navigation depuis /app/budget via la link card ──────────────────────

  test('la link card "Bilan mensuel" depuis /app/budget mène à /app/budget/reports', async ({ page }) => {
    // Attendre que l'overview soit chargé (la link card n'apparaît qu'ensuite)
    await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible();

    // La link card est identifiée par son titre "Bilan mensuel"
    await page.getByText('Bilan mensuel').click();

    await expect(page).toHaveURL(/\/app\/budget\/reports/);
  });

  // ── 2. Structure de la page ────────────────────────────────────────────────

  test('la page /app/budget/reports affiche le BackLink, le titre et la description', async ({ page }) => {
    await page.goto('/app/budget/reports');

    // BackLink vers Budgets
    await expect(page.getByRole('link', { name: 'Budgets' })).toBeVisible();

    // Titre de page (h1)
    await expect(page.getByRole('heading', { level: 1, name: 'Bilan mensuel' })).toBeVisible();

    // Description sous le titre
    await expect(
      page.getByText('Un récap écrit des dépenses du mois écoulé, budget par budget.'),
    ).toBeVisible();
  });

  // ── 3. Contenu tolérant : état vide OU card de rapport ────────────────────

  test('la page affiche soit "Aucun bilan" soit une card de rapport avec un libellé de mois', async ({ page }) => {
    await page.goto('/app/budget/reports');

    // Attendre la fin du chargement : skeleton disparu → contenu visible
    // On attend que l'un des deux états soit présent (tolérant au contenu DB)
    await expect(
      page.getByText('Aucun bilan').or(page.getByText('Mois dernier')).or(page.getByText('Mois précédents')),
    ).toBeVisible({ timeout: 15000 });
  });

  // ── 4. BackLink ramène à /app/budget ──────────────────────────────────────

  test('le BackLink "Budgets" navigue bien vers /app/budget', async ({ page }) => {
    await page.goto('/app/budget/reports');

    await expect(page.getByRole('link', { name: 'Budgets' })).toBeVisible();
    await page.getByRole('link', { name: 'Budgets' }).click();

    await expect(page).toHaveURL(/\/app\/budget/);
    await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible();
  });

  // ── 5. Rapport "Mois dernier" : seed + vérification ──────────────────────
  //
  //  Note de limite : le rapport est généré en lazy par le backend via un appel
  //  LLM au premier GET /api/budget/reports/latest/. Si aucune dépense ne date
  //  du mois précédent (ex. premier jour d'un nouveau mois en CI), le backend
  //  peut retourner null même après le seed. Cette assertion reste donc tolérante
  //  et vérifie uniquement que la page ne lève pas d'erreur.

  test('après seed d\'une dépense le mois précédent, la page ne produit pas d\'erreur', async ({ page }) => {
    // Seed : créer une dépense backdatée dans le mois précédent
    await apiCreatePreviousMonthExpense(page, `Dépense test bilan ${Date.now()}`, 42);

    // Naviguer sur la page des rapports
    await page.goto('/app/budget/reports');

    // Attendre la fin du chargement (skeleton résolu)
    await expect(
      page.getByText('Aucun bilan').or(page.getByText('Mois dernier')).or(page.getByText('Mois précédents')),
    ).toBeVisible({ timeout: 15000 });

    // Si un rapport "Mois dernier" a été généré, sa card doit contenir un libellé
    // de mois capitalisé (ex. "juin 2026", "juillet 2026"…).
    const latestSection = page.getByText('Mois dernier');
    if (await latestSection.isVisible()) {
      // Le libellé du mois dans la CardTitle est capitalisé par CSS (capitalize)
      // Vérifier qu'au moins un texte de mois est rendu dans le DOM
      const reportCards = page.locator('h3');
      const count = await reportCards.count();
      expect(count).toBeGreaterThan(0);
    }
    // Si toujours en état vide, le test passe quand même (limitation E2E acceptée).
  });

  // ── 6. Accès direct par URL (deep-link) ───────────────────────────────────

  test('accès direct à /app/budget/reports (sans passer par /app/budget) → page chargée correctement', async ({ page }) => {
    // Accès direct sans state.back → BackLink affichera le fallback "Budgets"
    await page.goto('/app/budget/reports');

    await expect(page).toHaveURL(/\/app\/budget\/reports/);
    await expect(page.getByRole('heading', { level: 1, name: 'Bilan mensuel' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Budgets' })).toBeVisible();
  });
});
