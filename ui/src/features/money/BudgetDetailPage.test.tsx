import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BudgetInsights } from '@/lib/api/budget';
import type { FetchInteractionsResult, InteractionListItem } from '@/lib/api/interactions';
import BudgetDetailPage from './BudgetDetailPage';

/**
 * Ce que ces tests tiennent, et pourquoi :
 *
 * 1. **La liste se parcourt, elle ne se tronque pas.** Elle s'arrêtait à 100
 *    lignes avec une note. Sous une sélection multiple, ce plafond devient un
 *    mensonge : « tout sélectionner » ne porterait que sur les cent premières
 *    pendant que le compteur du haut en annonce trois cents.
 * 2. **Cocher n'ouvre pas.** En mode sélection, le clic sur une ligne coche —
 *    viser une case de 16 px pour en cocher douze est un supplice, et partir sur
 *    la fiche au douzième clic perd le lot en cours.
 * 3. **⚠️ Changer d'enveloppe vide la sélection, y compris au retour.** La route
 *    est la même d'une enveloppe à l'autre : le composant n'est pas démonté.
 *    Arriver sur « Courses » remet bien le compteur à zéro sans rien de spécial
 *    (la sélection est dérivée des ids affichés), mais sans l'id dans la portée
 *    les lignes cochées sur « Bricolage » dorment dans le `Set` et se rallument
 *    au retour — un lot qu'on ne se sait plus tenir.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
    i18n: { language: 'fr' },
  }),
}));

// Graphiques et comparaisons : ils ne disent rien de la sélection, et recharts ne
// se mesure pas en jsdom.
vi.mock('@/components/charts/ConsumptionBarChart', () => ({ default: () => null }));
vi.mock('./ShareChart', () => ({ default: () => null }));
vi.mock('./InsightComparison', () => ({ default: () => null }));
vi.mock('@/features/expenses/PeriodPicker', () => ({ default: () => null }));
vi.mock('@/features/banking/AttachToTransactionDialog', () => ({ default: () => null }));
vi.mock('@/features/banking/LinkedLineActions', () => ({ default: () => null }));
vi.mock('./ReconciliationBadge', () => ({ default: () => null }));

/** Le dialogue de lot, réduit à ce qu'on veut vérifier : les ids qu'il reçoit. */
vi.mock('@/features/expenses/BulkEditDialog', () => ({
  default: ({ open, ids }: { open: boolean; ids: string[] }) =>
    open ? <div data-testid="bulk-ids">{ids.join(',')}</div> : null,
}));

const insights: BudgetInsights = {
  period: { from: '2026-07-01', to: '2026-07-31' },
  previous_period: { from: '2026-06-01', to: '2026-06-30' },
  current: { total: '900.00', refunded: '0.00', net_total: '900.00', count: 120 },
  previous: { total: '800.00', refunded: '0.00', net_total: '800.00', count: 110 },
  delta: { amount: '100.00', ratio: 0.125 },
  granularity: 'day',
  buckets: [],
  suppliers: [],
  budgets: [],
  budgets_returned: [],
  budgets_net_total: '900.00',
};

vi.mock('@/features/budget/hooks', () => ({
  useBudgetOverview: () => ({
    data: {
      categories: [],
      budgets: [
        { id: 'b-1', name: 'Bricolage', amount: '400.00', category_id: null },
        { id: 'b-2', name: 'Courses', amount: '600.00', category_id: null },
      ],
      global: null,
    },
    isLoading: false,
  }),
  useBudgetInsights: () => ({ data: insights, isLoading: false }),
  useBudgets: () => ({ data: [] }),
}));

vi.mock('@/features/banking/hooks', () => ({
  useTransactions: () => ({ data: { results: [] } }),
}));

function expense(id: string, subject: string): InteractionListItem {
  return {
    id,
    subject,
    content: '',
    type: 'expense',
    occurred_at: '2026-07-10T12:00:00Z',
    tags: [],
    zone_names: [],
    document_count: 0,
    amount: '42.00',
    supplier: 'Leroy Merlin',
  } as InteractionListItem;
}

/** 120 dépenses sur l'enveloppe : deux pages et demie, l'ancien plafond dépassé. */
const TOTAL = 120;

const fetchInteractions = vi.fn(
  async (options: { budget?: string; offset?: number } = {}): Promise<FetchInteractionsResult> => {
    const offset = options.offset ?? 0;
    const prefix = options.budget === 'b-2' ? 'c' : 'e';
    const items = Array.from({ length: Math.min(50, TOTAL - offset) }, (_, i) =>
      expense(`${prefix}${offset + i}`, `Dépense ${prefix}${offset + i}`),
    );
    return { items, count: TOTAL, next: null, previous: null };
  },
);

vi.mock('@/lib/api/interactions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/interactions')>(
    '@/lib/api/interactions',
  );
  return {
    ...actual,
    fetchInteractions: ((options) =>
      fetchInteractions(options)) as typeof actual.fetchInteractions,
  };
});

function renderPage(at = '/app/money/budgets/b-1') {
  const router = createMemoryRouter(
    [
      { path: '/app/money/budgets/:id', element: <BudgetDetailPage /> },
      // La fiche d'une dépense, en cul-de-sac : le test « cocher n'ouvre pas »
      // doit échouer sur son assertion de chemin, pas sur une erreur de routeur.
      { path: '*', element: null },
    ],
    { initialEntries: [at] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  fetchInteractions.mockClear();
  // La période vit dans `sessionStorage` (`useSessionState`) et survit au démontage :
  // un test qui en changerait la fixerait pour tous les suivants.
  sessionStorage.clear();
});

describe('BudgetDetailPage — la liste des dépenses', () => {
  it('se parcourt par pages au lieu de se tronquer', async () => {
    renderPage();

    await screen.findByText('Dépense e0');
    expect(fetchInteractions).toHaveBeenCalledWith(
      expect.objectContaining({ budget: 'b-1', limit: 50, offset: 0 }),
    );
    // « 1–50 sur 120 » plutôt que « 100 dépenses affichées sur 120 ».
    expect(screen.getByText('common.rangeOfTotal:1,50,120')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /common.next/ }));

    await screen.findByText('Dépense e50');
    expect(fetchInteractions).toHaveBeenCalledWith(expect.objectContaining({ offset: 50 }));
  });

  it('coche la ligne au lieu d’ouvrir sa fiche, en mode sélection', async () => {
    const router = renderPage();
    await screen.findByText('Dépense e0');

    await userEvent.click(screen.getByRole('button', { name: /common.select/ }));
    await userEvent.click(screen.getByText('Dépense e0'));

    expect(screen.getByText('expenses.bulk.selected:1')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app/money/budgets/b-1');
  });

  it('passe au lot exactement les lignes cochées', async () => {
    renderPage();
    await screen.findByText('Dépense e0');

    await userEvent.click(screen.getByRole('button', { name: /common.select/ }));
    await userEvent.click(screen.getByText('Dépense e0'));
    await userEvent.click(screen.getByText('Dépense e2'));
    await userEvent.click(screen.getByRole('button', { name: /expenses.bulk.action/ }));

    expect(screen.getByTestId('bulk-ids').textContent).toBe('e0,e2');
  });

  it('⚠️ vide la sélection quand on change d’enveloppe, retour compris', async () => {
    const router = renderPage();
    await screen.findByText('Dépense e0');

    await userEvent.click(screen.getByRole('button', { name: /common.select/ }));
    await userEvent.click(screen.getByText('Dépense e0'));
    expect(screen.getByText('expenses.bulk.selected:1')).toBeInTheDocument();

    // Même route, autre `:id` : le composant n'est pas démonté. Le compteur tombe
    // à zéro tout seul, la sélection étant dérivée des ids affichés.
    // ⚠️ Les libellés sont **distincts par enveloppe** (`e0` / `c0`), sans quoi
    // l'attente ci-dessous se satisfait des lignes de l'autre budget et le test
    // passe quoi qu'on fasse — c'est ce qui l'a rendu muet une première fois.
    await router.navigate('/app/money/budgets/b-2');
    await screen.findByText('Dépense c0');
    await waitFor(() =>
      expect(screen.getByText('expenses.bulk.selected:0')).toBeInTheDocument(),
    );

    // C'est **ici** que l'id de la portée se prouve : sans lui, `e0` a dormi dans
    // le `Set` pendant le détour et se rallume, sur un lot que l'utilisateur a
    // composé deux écrans plus tôt.
    await router.navigate('/app/money/budgets/b-1');
    await screen.findByText('Dépense e0');
    await waitFor(() =>
      expect(screen.getByText('expenses.bulk.selected:0')).toBeInTheDocument(),
    );
  });
});
