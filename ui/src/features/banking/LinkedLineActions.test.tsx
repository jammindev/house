import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LinkedLineActions from './LinkedLineActions';

const mutate = vi.fn();

vi.mock('./hooks', () => ({
  useUnlinkAllocation: () => ({ mutate, isPending: false }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderActions(kind: string | undefined) {
  return render(
    <MemoryRouter>
      <LinkedLineActions expenseId="exp-1" kind={kind} transactionId="txn-9" />
    </MemoryRouter>,
  );
}

describe('LinkedLineActions', () => {
  beforeEach(() => mutate.mockClear());

  it('détache une dépense rapprochée après coup', async () => {
    const user = userEvent.setup();
    renderActions('manual');

    await user.click(screen.getByRole('button'));

    expect(mutate).toHaveBeenCalledWith({ transactionId: 'txn-9', interactionId: 'exp-1' });
  });

  it.each(['project_purchase', 'recurring', 'stock_purchase', undefined])(
    'propose le détachement quel que soit le kind rapproché (%s)',
    (kind) => {
      renderActions(kind);
      expect(screen.getByRole('button')).toBeInTheDocument();
    },
  );

  it("renvoie à l'opération sur une dépense née de la ventilation", () => {
    // ⚠️ Le cœur de la règle, et la raison d'être des deux branches. Détacher une
    // dépense `kind='bank'` ne libère rien : elle *est* la ventilation. Le geste
    // laisserait d'un coup une dépense que plus rien ne justifie et une sortie
    // redevenue partiellement ventilée — deux écarts pour le même argent.
    renderActions('bank');

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/money/transactions/txn-9');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('offre toujours un geste, quel que soit le kind', () => {
    // La régression que la recette a trouvée : la version « détacher seulement »
    // n'affichait **rien** sur une dépense issue d'un relevé, c'est-à-dire sur la
    // quasi-totalité des dépenses d'un foyer qui importe ses relevés. Un badge
    // sans geste envoie chercher ailleurs ce qu'on croit absent.
    for (const kind of ['bank', 'manual', 'recurring', 'project_purchase']) {
      const { unmount } = renderActions(kind);
      expect(screen.getByRole(kind === 'bank' ? 'link' : 'button')).toBeInTheDocument();
      unmount();
    }
  });
});
