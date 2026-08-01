import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseList from './ExpenseList';
import ExpenseFilters from './ExpenseFilters';
import type { InteractionListItem } from '@/lib/api/interactions';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

// Ces deux-là interrogent le serveur et ne disent rien du manque de fournisseur.
vi.mock('@/features/banking/AttachToTransactionDialog', () => ({ default: () => null }));
vi.mock('@/features/banking/LinkedLineActions', () => ({ default: () => null }));
vi.mock('@/features/money/ReconciliationBadge', () => ({ default: () => null }));
vi.mock('./PeriodPicker', () => ({ default: () => null }));

function expense(over: Partial<InteractionListItem> = {}): InteractionListItem {
  return {
    id: 'e1',
    subject: 'Peinture',
    content: '',
    type: 'expense',
    occurred_at: '2026-07-10T12:00:00Z',
    tags: [],
    zone_names: [],
    document_count: 0,
    amount: '42.00',
    supplier: '',
    ...over,
  } as InteractionListItem;
}

function renderList(items: InteractionListItem[], flag = true) {
  return render(
    <MemoryRouter>
      <ExpenseList items={items} flagWithoutSupplier={flag} />
    </MemoryRouter>,
  );
}

/**
 * Ce que ces tests tiennent :
 *
 * 1. **La pastille et le filtre lisent la même source.** « Sans fournisseur » se
 *    déduit de `supplier`, servi par la liste — jamais d'un état local. Deux
 *    définitions du même manque, et un écran finirait par contredire l'autre sur la
 *    même dépense.
 * 2. **La pastille est réservée à l'onglet Dépenses.** La fiche d'un budget réutilise
 *    cette liste et n'y pose pas la même question : une pastille de plus sur chaque
 *    ligne n'y avertirait de rien.
 * 3. **Les deux filtres fournisseur s'excluent.** « Chez Leclerc » et « sans
 *    fournisseur » ne peuvent pas être vrais ensemble ; les cumuler ne rendrait
 *    jamais qu'une liste vide, sans dire pourquoi.
 */
describe('la pastille « sans fournisseur »', () => {
  it('signale une dépense à laquelle il manque un fournisseur', () => {
    renderList([expense()]);

    expect(screen.getByText('expenses.withoutSupplier')).toBeInTheDocument();
  });

  it('se tait dès que la dépense en a un', () => {
    renderList([expense({ supplier: 'Decathlon' })]);

    expect(screen.queryByText('expenses.withoutSupplier')).not.toBeInTheDocument();
  });

  it("reste absente hors de l'onglet Dépenses, même sans fournisseur", () => {
    renderList([expense()], false);

    expect(screen.queryByText('expenses.withoutSupplier')).not.toBeInTheDocument();
  });

  it('ne suppose pas que le payload porte le champ', () => {
    // Une entrée encore en cache avant ce changement n'a pas de `supplier` : la
    // pastille doit se décider, pas planter.
    const legacy = { ...expense(), supplier: undefined } as InteractionListItem;
    renderList([legacy]);

    expect(screen.getByText('expenses.withoutSupplier')).toBeInTheDocument();
  });

  it("traite une valeur d'espaces comme une absence", () => {
    // Aucune écriture n'en produit plus, mais un import historique a pu en laisser.
    // Le filtre serveur les couvre aussi — les deux doivent dire la même chose.
    renderList([expense({ supplier: '   ' })]);

    expect(screen.getByText('expenses.withoutSupplier')).toBeInTheDocument();
  });
});

describe('le filtre « sans fournisseur »', () => {
  const noop = () => {};

  function renderFilters(over: Partial<React.ComponentProps<typeof ExpenseFilters>> = {}) {
    return render(
      <ExpenseFilters
        period={{ preset: 'month', month: '2026-07' }}
        onPeriodChange={noop}
        supplier=""
        onSupplierChange={noop}
        withoutSupplier={false}
        onWithoutSupplierToggle={noop}
        kind=""
        onKindChange={noop}
        supplierOptions={[]}
        kindOptions={[]}
        {...over}
      />,
    );
  }

  it("s'affiche même quand aucun fournisseur n'est encore connu", () => {
    // C'est précisément le cas où tout en manque, donc celui où le filtre sert le
    // plus. Le rendre dépendant des fournisseurs connus l'aurait caché à qui n'a
    // encore rien nommé.
    renderFilters();

    expect(screen.getByText('expenses.filters.withoutSupplier')).toBeInTheDocument();
  });

  it('éteint « Tous les fournisseurs » quand il est actif', () => {
    // Deux pastilles actives à la fois annonceraient deux filtres pour une liste.
    renderFilters({ withoutSupplier: true });

    const all = screen.getByText('expenses.filters.allSuppliers').closest('button');
    const without = screen.getByText('expenses.filters.withoutSupplier').closest('button');
    expect(without).toHaveAttribute('aria-pressed', 'true');
    expect(all).toHaveAttribute('aria-pressed', 'false');
  });

  it("désactive la pastille d'un fournisseur choisi tant qu'il est actif", () => {
    renderFilters({ withoutSupplier: true, supplier: 'Decathlon', supplierOptions: ['Decathlon'] });

    expect(screen.getByText('Decathlon').closest('button')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
