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

const insights: BudgetInsights = {
  period: { from: '2026-07-01', to: '2026-07-31' },
  previous_period: { from: '2026-06-01', to: '2026-06-30' },
  current: { total: '230.50', refunded: '40.00', net_total: '190.50', count: 2 },
  previous: { total: '170.00', refunded: '0.00', net_total: '170.00', count: 3 },
  delta: { amount: '20.50', ratio: 0.1206 },
  granularity: 'day',
  buckets: [{ label: '2026-07-01', total: '150.00' }],
  suppliers: [],
  // Deux enveloppes seulement : « Eau » n'a rien dépensé sur la fenêtre.
  budgets: [
    { budget_id: 'b-1', name: 'Bricolage', total: '150.00', count: 1, share: 0.6508 },
    { budget_id: 'b-2', name: 'Énergie', total: '80.50', count: 1, share: 0.3492 },
  ],
};

vi.mock('@/features/budget/hooks', () => ({
  useBudgetOverview: () => ({
    data: {
      categories: [category],
      budgets: [
        envelope({ id: 'b-1', name: 'Bricolage', spent: '150.00', net_spent: '150.00' }),
        envelope({ id: 'b-2', name: 'Énergie', spent: '80.50', net_spent: '80.50' }),
        envelope({ id: 'b-3', name: 'Eau' }),
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

    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
  });

  it('liste toutes ses enveloppes, y compris celle absente de l’anneau', () => {
    renderPage();

    for (const name of ['Bricolage', 'Énergie', 'Eau']) {
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
