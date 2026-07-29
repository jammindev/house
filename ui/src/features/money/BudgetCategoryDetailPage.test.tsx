import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { BudgetCategoryRow, BudgetInsights, BudgetOverviewRow } from '@/lib/api/budget';
import BudgetCategoryDetailPage from './BudgetCategoryDetailPage';

/**
 * Ce que ces tests tiennent, et pourquoi :
 *
 * 1. **Le chiffre de tête vient du serveur, jamais des cartes affichées.** Une
 *    catégorie ne porte aucune dépense : son sous-total est une lecture des
 *    dépenses de ses enveloppes, calculée à un seul endroit. Le recomposer ici
 *    depuis les lignes visibles donnerait au même compteur une seconde
 *    définition — et cliquer sur un chiffre ouvrirait son démenti.
 * 2. **Les parts de l'anneau sont celles du serveur.** Même raison : une part
 *    dérivée dans le navigateur dériverait du total qu'elle décompose.
 * 3. **Une enveloppe sans dépense est absente de l'anneau mais présente dans la
 *    liste.** Une part à 0 % est un filet illisible ; l'oublier complètement
 *    ferait croire que l'enveloppe n'existe pas.
 */

const category: BudgetCategoryRow = {
  id: 'cat-1',
  name: 'Maison',
  amount: '450.00',
  has_own_amount: false,
  spent: '230.50',
  spent_attested: '150.00',
  spent_pending: '80.50',
  refunded: '40.00',
  net_spent: '190.50',
  committed: '0.00',
  ratio: 0.4233,
  state: 'ok',
  budget_count: 3,
};

function envelope(over: Partial<BudgetOverviewRow> & { id: string; name: string }): BudgetOverviewRow {
  return {
    amount: null,
    spent: '0.00',
    spent_attested: '0.00',
    spent_pending: '0.00',
    refunded: '0.00',
    net_spent: '0.00',
    committed: '0.00',
    ratio: 0,
    state: 'uncapped',
    category_id: 'cat-1',
    ...over,
  };
}

/**
 * Fenêtre demandée : juin. Les cartes de l'aperçu (mockées ci-dessous) portent
 * **juillet** — c'est le piège que ces tests tiennent fermé.
 */
const insights: BudgetInsights = {
  period: { from: '2026-06-01', to: '2026-06-30' },
  previous_period: { from: '2026-05-01', to: '2026-05-31' },
  current: { total: '230.50', refunded: '40.00', net_total: '190.50', count: 2 },
  previous: { total: '170.00', refunded: '0.00', net_total: '170.00', count: 3 },
  delta: { amount: '20.50', ratio: 0.1206 },
  granularity: 'day',
  buckets: [{ label: '2026-06-01', total: '150.00' }],
  suppliers: [],
  kinds: [],
  budgets: [
    {
      budget_id: 'b-1',
      name: 'Bricolage',
      total: '150.00',
      refunded: '0.00',
      net_total: '150.00',
      count: 1,
      share: 0.7143,
    },
    {
      budget_id: 'b-2',
      name: 'Énergie',
      total: '80.50',
      refunded: '20.00',
      net_total: '60.50',
      count: 1,
      share: 0.2857,
    },
  ],
  // Rendu plus que dépensé sur la fenêtre : hors de l'anneau, mais nommée.
  budgets_returned: [
    {
      budget_id: 'b-3',
      name: 'Eau',
      total: '0.00',
      refunded: '20.00',
      net_total: '-20.00',
      count: 0,
      share: 0,
    },
  ],
  budgets_net_total: '210.50',
};

vi.mock('@/features/budget/hooks', () => ({
  // ⚠️ L'aperçu est **toujours** le mois en cours (juillet ici) : ses montants
  // n'ont rien à voir avec la fenêtre demandée. Ils sont volontairement
  // reconnaissables — aucun ne doit apparaître à l'écran.
  useBudgetOverview: () => ({
    data: {
      categories: [category],
      budgets: [
        envelope({ id: 'b-1', name: 'Bricolage', spent: '999.11', net_spent: '999.11' }),
        envelope({ id: 'b-2', name: 'Énergie', spent: '888.22', net_spent: '888.22' }),
        envelope({ id: 'b-3', name: 'Eau', spent: '777.33', net_spent: '777.33' }),
        envelope({ id: 'b-5', name: 'Bois' }),
        envelope({ id: 'b-4', name: 'Loisirs', category_id: null }),
      ],
      global: null,
    },
    isLoading: false,
  }),
  useBudgetCategoryInsights: () => ({ data: insights, isLoading: false }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/money/categories/cat-1']}>
      <Routes>
        <Route path="/app/money/categories/:id" element={<BudgetCategoryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BudgetCategoryDetailPage', () => {
  it('affiche le net du serveur, pas la somme des cartes visibles', () => {
    const { container } = renderPage();

    // 150,00 + 80,50 = 230,50 brut ; le chiffre de tête est le **net** que le
    // serveur a calculé. Le resommer ici afficherait 230,50 € sous un plafond
    // mesuré sur 190,50 €.
    // 190,50 n'est la somme d'aucune ligne visible : ce chiffre ne peut venir
    // que du serveur.
    expect(container.textContent).toContain('190.50');
    expect(screen.getByText('Maison')).toBeInTheDocument();
  });

  it("dit d'où vient le plafond quand ce n'est pas le sien", () => {
    const { container } = renderPage();

    // « / 450 € » sur une catégorie qui n'a pas de plafond propre laisse sinon
    // croire qu'un chiffre a été saisi quelque part.
    expect(container.textContent).toContain('450.00');
    expect(container.textContent).toContain('budget.category.sumHint');
  });

  it('rend les parts telles que le serveur les donne', () => {
    renderPage();

    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getByText('29%')).toBeInTheDocument();
  });

  it('⚠️ les enveloppes portent les chiffres de la période, pas ceux du mois en cours', () => {
    const { container } = renderPage();

    // Le bug livré le 29/07 : la liste lisait l'aperçu, figé sur le mois en
    // cours. La page annonçait juin en tête et affichait juillet en bas — deux
    // mois dans le même écran, ce qui faisait passer un remboursement de juillet
    // pour une incohérence du total de juin.
    for (const currentMonthOnly of ['999.11', '888.22', '777.33']) {
      expect(container.textContent).not.toContain(currentMonthOnly);
    }
    expect(container.textContent).toContain('150.00');
    expect(container.textContent).toContain('60.50');
  });

  it('nomme l’enveloppe qui a rendu plus qu’elle n’a dépensé', () => {
    const { container } = renderPage();

    // Elle ne peut pas être une part (une part négative ne se dessine pas) mais
    // la taire ferait croire qu'aucun argent n'est revenu.
    expect(screen.getAllByText('Eau').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('budget.category.detail.returned.title');
  });

  it('liste toutes ses enveloppes, y compris celles qui n’ont pas bougé', () => {
    renderPage();

    for (const name of ['Bricolage', 'Énergie', 'Eau', 'Bois']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    // Une enveloppe d'une autre catégorie n'entre jamais dans la fiche.
    expect(screen.queryByText('Loisirs')).not.toBeInTheDocument();
  });

  it('mène à la fiche de chaque enveloppe', () => {
    renderPage();

    const link = screen.getAllByRole('link').find((a) => a.textContent?.includes('Bricolage'));
    expect(link).toHaveAttribute('href', '/app/money/budgets/b-1');
  });
});
