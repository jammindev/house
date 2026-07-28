import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { InteractionListItem } from '@/lib/api/interactions';
import ExpenseDetailPage from './ExpenseDetailPage';
import InteractionDetailPage from '@/features/interactions/InteractionDetailPage';

/**
 * Ce que ces tests tiennent, et pourquoi :
 *
 * 1. **Une dépense a sa propre page**, et la fiche générique y renvoie. Sans la
 *    redirection, les liens du fil d'activité et de la fiche projet continueraient
 *    d'ouvrir un écran qui ne dit pas dans quelle enveloppe l'euro tombe.
 * 2. **Le classement se lit sur la fiche.** Le budget est le seul axe qui classe un
 *    euro : une fiche de dépense qui ne l'affiche pas manque son seul sujet.
 * 3. **Les dépenses sœurs sont visibles.** 90 € lus sur une sortie de 150 € sans
 *    trace des 60 autres ressemblent à une erreur de saisie.
 */

const expense: Partial<InteractionListItem> = {
  id: 'exp-1',
  subject: 'MAGASIN U',
  type: 'expense',
  content: '',
  occurred_at: '2026-07-10T12:00:00Z',
  tags: [],
  zone_names: [],
  amount: '90.00',
  kind: 'bank',
  supplier: 'Magasin U',
  budget: { id: 'b-1', name: 'Courses' },
  reconciliation_state: 'attested',
  bank_line: {
    id: 'txn-9',
    label: 'CB MAGASIN U',
    booked_on: '2026-07-10',
    account_name: 'Compte courant',
  },
};

let current: Partial<InteractionListItem> = expense;

vi.mock('@/features/interactions/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/features/interactions/hooks')>(
    '@/features/interactions/hooks',
  );
  return {
    ...actual,
    useInteraction: () => ({ data: current, isLoading: false, error: null }),
    useDeleteInteraction: () => ({ mutate: vi.fn(), isPending: false }),
    useAttachDocumentToInteraction: () => ({ mutate: vi.fn() }),
  };
});

vi.mock('@/features/banking/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/features/banking/hooks')>(
    '@/features/banking/hooks',
  );
  return {
    ...actual,
    useAllocations: () => ({
      data: {
        transaction: { id: 'txn-9' },
        allocations: [
          { id: 'exp-1', subject: 'MAGASIN U', amount: '90.00', budget: { id: 'b-1', name: 'Courses' } },
          { id: 'exp-2', subject: 'Bricolage', amount: '60.00', budget: { id: 'b-2', name: 'Travaux' } },
        ],
        allocated: '150.00',
        remaining: '0.00',
      },
    }),
  };
});

vi.mock('@/features/documents/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/features/documents/hooks')>(
    '@/features/documents/hooks',
  );
  return { ...actual, useDocuments: () => ({ data: [] }) };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/interactions/:id" element={<InteractionDetailPage />} />
          <Route path="/app/money/expenses/:id" element={<ExpenseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('la fiche dédiée à une dépense', () => {
  beforeAll(() => {
    // jsdom n'implémente pas matchMedia, utilisé par useIsMobile (SheetDialog).
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  beforeEach(() => {
    current = expense;
  });

  it('affiche le montant, le fournisseur et l’enveloppe', () => {
    renderAt('/app/money/expenses/exp-1');

    // `formatAmount` suit la locale du système : on n'y compare ni le séparateur
    // décimal ni la place du symbole.
    expect(screen.getByText(/90[.,]00/)).toBeTruthy();
    expect(screen.getByText('Courses')).toBeTruthy();
    expect(screen.getByText(/Magasin U/)).toBeTruthy();
  });

  it('nomme les dépenses sœurs de la même opération, sans se compter elle-même', () => {
    renderAt('/app/money/expenses/exp-1');

    expect(screen.getByText(/Travaux/)).toBeTruthy();
    const links = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((href) => href?.startsWith('/app/money/expenses/'));
    // La sœur est atteignable, et la dépense courante ne se lie pas à elle-même.
    expect(links).toContain('/app/money/expenses/exp-2');
    expect(links).not.toContain('/app/money/expenses/exp-1');
  });

  it('dit qu’une dépense sans enveloppe n’est classée nulle part, et propose d’y remédier', () => {
    current = { ...expense, budget: null };
    renderAt('/app/money/expenses/exp-1');

    expect(screen.getByText('money.expense.noBudget')).toBeTruthy();
    expect(screen.getByText('money.expense.pickBudget')).toBeTruthy();
  });

  it('mène à l’opération qui la justifie', () => {
    renderAt('/app/money/expenses/exp-1');

    const link = screen.getByText('CB MAGASIN U').closest('a');
    expect(link?.getAttribute('href')).toBe('/app/money/transactions/txn-9');
  });

  it('renvoie la fiche générique d’une dépense vers sa page dédiée', () => {
    renderAt('/app/interactions/exp-1');

    // La page de dépense a rendu : son bloc « classement » n'existe nulle part ailleurs.
    expect(screen.getByText('money.expense.classification')).toBeTruthy();
  });

  it('garde la fiche générique pour ce qui n’est pas une dépense', () => {
    current = {
      ...expense,
      type: 'note',
      subject: 'Réunion syndic',
      amount: null,
      kind: '',
      bank_line: null,
      budget: null,
    };
    renderAt('/app/interactions/exp-1');

    expect(screen.getByText('Réunion syndic')).toBeTruthy();
    expect(screen.queryByText('money.expense.classification')).toBeNull();
  });
});
