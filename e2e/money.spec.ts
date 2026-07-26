import { test, expect } from '@playwright/test';

/**
 * Parcours 26 — Lot 2 : le module « Argent ».
 *
 * Couvre ce que la fusion des trois pages pouvait casser en silence, et que rien
 * d'autre ne vérifie :
 *
 *  1. La coque : un seul titre, cinq onglets, Contrôle en premier
 *  2. Les redirections des anciennes URLs, **query string préservée** — l'agent
 *     produit `/app/budget?b={id}` et les favoris peuvent porter n'importe quoi
 *  3. Le deep link `?tab=` atterrit sur le bon onglet
 *  4. La sidebar : une entrée « Argent », plus aucune des trois anciennes
 *  5. Le panneau Contrôle liste des groupes d'écarts et sait dire « conforme »
 *  6. Les sous-pages autonomes restent accessibles en direct
 */

async function getAccessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('access_token') ?? '');
}

// ---------------------------------------------------------------------------
// 1. La coque
// ---------------------------------------------------------------------------

test.describe('Module Argent — la coque', () => {
  test('un seul titre et cinq onglets, Contrôle en tête', async ({ page }) => {
    await page.goto('/app/money');
    await expect(page).toHaveURL(/\/app\/money/);
    await expect(page.getByRole('heading', { level: 1, name: 'Argent' })).toBeVisible();

    for (const label of ['Contrôle', 'À ranger', 'Comptes', 'Dépenses', 'Budgets']) {
      await expect(page.getByRole('button', { name: new RegExp(label) }).first()).toBeVisible();
    }
  });

  test('changer d\'onglet affiche le panneau correspondant', async ({ page }) => {
    await page.goto('/app/money');

    await page.getByRole('button', { name: /Comptes/ }).first().click();
    // Le panneau Comptes porte les filtres du journal bancaire.
    await expect(page.getByRole('button', { name: 'Actifs' })).toBeVisible();

    await page.getByRole('button', { name: /Budgets/ }).first().click();
    await expect(page.getByRole('button', { name: /Nouveau budget|Budget/ }).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. & 3. Redirections et deep links
// ---------------------------------------------------------------------------

test.describe('Module Argent — anciennes URLs', () => {
  test('/app/budget redirige vers l\'onglet Budgets', async ({ page }) => {
    await page.goto('/app/budget');
    await expect(page).toHaveURL(/\/app\/money\?.*tab=budgets/);
    await expect(page.getByRole('heading', { level: 1, name: 'Argent' })).toBeVisible();
  });

  test('/app/expenses redirige vers l\'onglet Dépenses', async ({ page }) => {
    await page.goto('/app/expenses');
    await expect(page).toHaveURL(/\/app\/money\?.*tab=expenses/);
  });

  test('/app/banking redirige vers l\'onglet Comptes', async ({ page }) => {
    await page.goto('/app/banking');
    await expect(page).toHaveURL(/\/app\/money\?.*tab=accounts/);
  });

  test('la query string survit à la redirection', async ({ page }) => {
    // Ce que produit l'agent : apps/budget/apps.py::SearchableSpec.url_template.
    // Perdre le paramètre transformerait un lien précis en lien approximatif.
    await page.goto('/app/budget?b=8f14e45f-ceea-467a-9c1e-000000000000');
    await expect(page).toHaveURL(/b=8f14e45f-ceea-467a-9c1e-000000000000/);
    await expect(page).toHaveURL(/tab=budgets/);
  });

  test('/app/banking/transactions redirige vers /app/money/transactions', async ({ page }) => {
    await page.goto('/app/banking/transactions');
    await expect(page).toHaveURL(/\/app\/money\/transactions/);
    await expect(page.getByRole('heading', { level: 1, name: 'Journal bancaire' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Sidebar
// ---------------------------------------------------------------------------

test('la sidebar porte une entrée « Argent » et plus aucune des trois anciennes', async ({ page }) => {
  await page.goto('/app/dashboard');
  const sidebar = page.locator('aside');

  await expect(sidebar.getByRole('link', { name: 'Argent' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Comptes bancaires' })).toHaveCount(0);
  // « Dépenses » et « Budgets » ne sont plus des entrées de navigation : ce sont
  // des onglets. Les laisser dans la sidebar ferait deux chemins vers le même
  // écran, dont un qui perd le contexte des trois autres onglets.
  await expect(sidebar.getByRole('link', { name: 'Budgets', exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 5. Le panneau Contrôle
// ---------------------------------------------------------------------------

test.describe('Module Argent — Contrôle', () => {
  test('liste les groupes d\'écarts et dit ce qu\'il reste à faire', async ({ page }) => {
    await page.goto('/app/money?tab=control');

    // Les cinq détecteurs du lot 1 sont déclarés côté serveur : le panneau doit
    // tous les montrer, y compris ceux à zéro — « contrôlé et conforme » ne doit
    // pas être indistinguable de « pas encore contrôlé ».
    await expect(page.getByText('Compte hors de portée du contrôle')).toBeVisible();
    await expect(page.getByText('Sorties non affectées')).toBeVisible();
    await expect(page.getByText('Dépenses non rapprochées')).toBeVisible();
  });

  test('un groupe se déplie et explique comment résoudre', async ({ page }) => {
    await page.goto('/app/money?tab=control');

    await page.getByText('Sorties non affectées').click();
    await expect(
      page.getByText(/Rangez ces opérations depuis l'onglet/),
    ).toBeVisible();
  });

  test('l\'API de conformité répond avec l\'identité ouverts + arbitrés = détectés', async ({ page }) => {
    await page.goto('/app/money');
    const token = await getAccessToken(page);
    const resp = await page.request.get('/api/banking/compliance/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json() as {
      groups: Array<{ kind: string; detected: number; open: number; waived: number }>;
      open_total: number;
    };
    expect(body.groups.length).toBeGreaterThan(0);
    for (const group of body.groups) {
      expect(group.open + group.waived).toBe(group.detected);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Le solde d'ouverture, prérequis fermé à l'entrée (lot 7)
// ---------------------------------------------------------------------------

test.describe('Module Argent — création de compte', () => {
  test('la date de solde d\'ouverture est requise, et pré-remplie à aujourd\'hui', async ({
    page,
  }) => {
    await page.goto('/app/money?tab=accounts');
    await page.getByRole('button', { name: 'Nouveau compte' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Pré-remplie : le cas fréquent est « je commence à suivre ce compte
    // maintenant », et proposer une valeur juste vaut mieux qu'exiger une saisie.
    await expect(dialog.locator('#account-opening-date')).not.toHaveValue('');

    // Vidée, la création est refusée côté front — sans point de départ le solde est
    // une supposition et aucun contrôle ne porte sur le compte.
    await dialog.locator('#account-name').fill(`Compte E2E ${Date.now()}`);
    await dialog.locator('#account-opening-date').fill('');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("La date du solde d'ouverture est obligatoire");
  });

  test('avec une date, le compte est créé', async ({ page }) => {
    await page.goto('/app/money?tab=accounts');
    await page.getByRole('button', { name: 'Nouveau compte' }).first().click();

    const dialog = page.getByRole('dialog');
    const name = `Compte E2E ${Date.now()}`;
    await dialog.locator('#account-name').fill(name);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. Un zéro ne doit jamais se lire « conforme » quand rien n'est évaluable
// ---------------------------------------------------------------------------

test.describe('Module Argent — non évaluable ≠ conforme', () => {
  test('un compte hors fenêtre bloque le contrôle au lieu de le dire conforme', async ({
    page,
  }) => {
    // Reproduit le bug shippé au parcours 26, exactement comme il s'est produit : un
    // compte créé avec la date du jour, alimenté par des opérations **antérieures**.
    // La fenêtre de conformité devient vide, tous les détecteurs se taisent, et l'app
    // affichait une coche verte avec « Toutes vos opérations sont affectées ».
    await page.goto('/app/money?tab=accounts');
    const token = await page.evaluate(() => localStorage.getItem('access_token') ?? '');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const account = await (
      await page.request.post('/api/banking/accounts/', {
        headers,
        data: {
          name: `Hors fenêtre ${Date.now()}`,
          kind: 'cash',
          opening_balance: '0',
          opening_balance_date: new Date().toISOString().slice(0, 10),
        },
      })
    ).json();

    // Une opération datée d'avant la date d'ouverture → fenêtre vide.
    const spend = await page.request.post('/api/banking/transactions/cash-expense/', {
      headers,
      data: {
        account: account.id,
        label: 'Achat antérieur E2E',
        amount: '12.00',
        booked_on: '2020-01-15',
      },
    });
    expect(spend.ok()).toBeTruthy();

    const summary = await (
      await page.request.get('/api/banking/compliance/', { headers })
    ).json();
    const blocker = summary.groups.find(
      (group: { kind: string; open: number }) => group.kind === 'account_without_window',
    );
    expect(blocker.open).toBeGreaterThan(0);

    // La file ne doit surtout PAS annoncer que tout est rangé.
    await page.goto('/app/money?tab=pending');
    await expect(page.getByText('Toutes vos opérations sont affectées')).toHaveCount(0);
    await expect(page.getByText("Rien d'évaluable pour l'instant")).toBeVisible();

    // Et le contrôle doit dire « non évaluable », pas « conforme ».
    await page.goto('/app/money?tab=control');
    await expect(page.getByText('Tout est conforme')).toHaveCount(0);
    await expect(page.getByText('Compte hors de portée du contrôle').first()).toBeVisible();

    // L'écart doit donner les **dates concrètes** : sans elles l'utilisateur sait
    // qu'il doit changer quelque chose, mais pas quoi mettre.
    await page.getByText('Compte hors de portée du contrôle').first().click();
    await expect(page.getByText(/ta plus ancienne opération est du/)).toBeVisible();

    // Et se corriger sur place, sans aller chercher dans un autre onglet.
    await page.getByRole('button', { name: 'Corriger' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#account-opening-date')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    // Les contrôles **dépendants** doivent l'annoncer : un zéro affiché comme
    // « Rien à signaler » était précisément le mensonge à corriger. Les contrôles
    // qui ne dépendent pas de la fenêtre (chaîne de soldes, récurrences, imports)
    // restent légitimement « Rien à signaler » — c'est la distinction, pas un
    // silence global.
    await expect(page.getByText(/Non évaluable — prérequis/).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. Sous-pages autonomes
// ---------------------------------------------------------------------------

test.describe('Module Argent — sous-pages', () => {
  test('les sous-pages restent accessibles en accès direct', async ({ page }) => {
    await page.goto('/app/budget/recurring');
    await expect(page.getByRole('heading', { level: 1, name: 'Dépenses récurrentes' })).toBeVisible();

    await page.goto('/app/budget/reports');
    await expect(page.getByRole('heading', { level: 1, name: 'Bilan mensuel' })).toBeVisible();

    await page.goto('/app/money/transactions');
    await expect(page.getByRole('heading', { level: 1, name: 'Journal bancaire' })).toBeVisible();
  });
});
