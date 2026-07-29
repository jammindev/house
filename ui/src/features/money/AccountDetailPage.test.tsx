import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AccountCoverage, BankAccount } from '@/lib/api/banking';
import AccountDetailPage from './AccountDetailPage';

/**
 * Ce que ces tests tiennent, et pourquoi :
 *
 * 1. **Un compte non évaluable ne se lit jamais comme un compte couvert.** C'est la
 *    règle transverse du parcours 26, et le bug qui a shippé : une date de solde
 *    d'ouverture postérieure aux relevés vidait la fenêtre de conformité, et l'app
 *    annonçait « tout est affecté » sans avoir rien vérifié. La fiche doit nommer
 *    la cause, et proposer de la corriger.
 * 2. **Un compte neuf n'est pas un compte en faute.** `no_data` et
 *    `opening_date_after_data` renvoient tous deux « pas de fenêtre » : les rendre
 *    pareil reproduirait la confusion à l'identique, dans l'autre sens.
 * 3. **Le reste à ranger vient du serveur**, du même filtre que le badge Contrôle,
 *    et il mène à la liste filtrée — un compteur sans destination n'est pas
 *    actionnable.
 */

const account: BankAccount = {
  id: 'acc-1',
  name: 'Compte joint',
  bank_label: 'Crédit Agricole',
  kind: 'bank',
  currency: 'EUR',
  iban_last4: '4242',
  opening_balance: '1000.00',
  opening_balance_date: '2026-01-01',
  attested_balance: null,
  attested_on: null,
  default_provider: 'generic_csv',
  import_options: {},
  archived: false,
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
};

const covered: AccountCoverage = {
  status: '',
  start: '2026-01-01',
  end: '2026-07-20',
  gaps: [],
  first_line: '2026-01-03',
  last_line: '2026-07-20',
  transaction_count: 128,
};

let currentAccount: BankAccount = account;
let currentCoverage: AccountCoverage = covered;
let pendingCount = 0;

vi.mock('@/features/banking/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/features/banking/hooks')>(
    '@/features/banking/hooks',
  );
  return {
    ...actual,
    useBankAccounts: () => ({ data: [currentAccount], isLoading: false, error: null }),
    useAccountCoverage: () => ({ data: currentCoverage, isLoading: false }),
    useAccountBalance: () => ({
      data: { amount: '1240.00', source: 'anchored', as_of: '2026-07-20', is_reliable: true, gaps: [] },
      isLoading: false,
    }),
    useAccountFlow: () => ({
      data: {
        date_from: null,
        date_to: null,
        outflow: '900.00',
        inflow: '2100.00',
        net: '1200.00',
        transaction_count: 128,
        internal_count: 2,
        unallocated_outflow: '90.00',
        coverage_ratio: 0.9,
      },
    }),
    useStatementImports: () => ({ data: [] }),
    // La file « à ranger » du compte : c'est le `count` du serveur, filtre
    // `allocation=todo` — jamais un calcul local sur les montants.
    useTransactions: (filters: { allocation?: string }) => ({
      data:
        filters.allocation === 'todo'
          ? { count: pendingCount, next: null, previous: null, results: [] }
          : { count: 0, next: null, previous: null, results: [] },
      isLoading: false,
    }),
    useArchiveBankAccount: () => ({ mutate: vi.fn(), isPending: false }),
    useRestoreBankAccount: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && 'count' in values ? `${key}:${values.count}` : key,
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/app/money/accounts/acc-1']}>
        <Routes>
          <Route path="/app/money/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('la fiche d’un compte', () => {
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
    currentAccount = account;
    currentCoverage = covered;
    pendingCount = 0;
  });

  it('annonce la période contrôlée quand le compte en a une', () => {
    renderPage();

    expect(screen.getByText('banking.account.coverageWindow')).toBeTruthy();
    expect(screen.queryByText(/banking\.account\.coverageNone/)).toBeNull();
  });

  it('nomme la cause quand le contrôle ne porte sur rien, et propose de la corriger', () => {
    currentCoverage = { ...covered, status: 'opening_date_after_data', start: null, end: null };
    renderPage();

    // ⚠️ Jamais « couvert » : le compte est *non évaluable*, ce qui est un écart.
    expect(screen.queryByText('banking.account.coverageWindow')).toBeNull();
    expect(
      screen.getByText('banking.account.coverageNone.opening_date_after_data'),
    ).toBeTruthy();
    expect(screen.getByText('money.compliance.fix')).toBeTruthy();
  });

  it('ne reproche rien à un compte dont rien n’a encore été importé', () => {
    currentCoverage = { ...covered, status: 'no_data', start: null, end: null, transaction_count: 0 };
    renderPage();

    expect(screen.getByText('banking.account.coverageNone.no_data')).toBeTruthy();
    // Rien à corriger : un compte neuf n'est pas en faute.
    expect(screen.queryByText('money.compliance.fix')).toBeNull();
  });

  it('liste les périodes qu’aucun relevé n’a jamais couvertes', () => {
    currentCoverage = {
      ...covered,
      gaps: [{ gap_start: '2026-02-01', gap_end: '2026-02-28', days: 28 }],
    };
    renderPage();

    expect(screen.getByText('banking.account.gapsTitle')).toBeTruthy();
    expect(screen.getByText('banking.account.coverageGap:28')).toBeTruthy();
  });

  it('mène de son compteur « à ranger » à la liste filtrée sur ce compte', () => {
    pendingCount = 3;
    renderPage();

    expect(screen.getByText('banking.account.pendingCount:3')).toBeTruthy();
    const link = screen.getByText('banking.account.pendingAction').closest('a');
    expect(link?.getAttribute('href')).toBe(
      '/app/money/transactions?account=acc-1&allocation=todo',
    );
  });

  it('ne propose pas de ranger ce qui n’attend pas', () => {
    renderPage();

    expect(screen.getByText('banking.account.pendingNone')).toBeTruthy();
    expect(screen.queryByText('banking.account.pendingAction')).toBeNull();
  });

  it('remplace les gestes d’un compte archivé par « rouvrir », sans rien détruire', () => {
    currentAccount = { ...account, archived: true };
    renderPage();

    expect(screen.getByText('banking.account.archivedHint')).toBeTruthy();
    expect(screen.getByText('banking.reopen')).toBeTruthy();
    expect(screen.queryByText('banking.archive')).toBeNull();
    expect(screen.queryByText('banking.import.action')).toBeNull();
  });
});
