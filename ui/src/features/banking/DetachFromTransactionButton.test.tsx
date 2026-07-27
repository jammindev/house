import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DetachFromTransactionButton from './DetachFromTransactionButton';

const mutate = vi.fn();

vi.mock('./hooks', () => ({
  useUnlinkAllocation: () => ({ mutate, isPending: false }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('DetachFromTransactionButton', () => {
  beforeEach(() => mutate.mockClear());

  it('détache la dépense de son opération', async () => {
    const user = userEvent.setup();
    render(
      <DetachFromTransactionButton expenseId="exp-1" kind="manual" transactionId="txn-9" />,
    );

    await user.click(screen.getByRole('button'));

    expect(mutate).toHaveBeenCalledWith({ transactionId: 'txn-9', interactionId: 'exp-1' });
  });

  it.each(['project_purchase', 'recurring', 'stock_purchase', undefined])(
    'reste offert sur une dépense rapprochée ailleurs (kind=%s)',
    (kind) => {
      render(<DetachFromTransactionButton expenseId="exp-1" kind={kind} transactionId="txn-9" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    },
  );

  it("ne s'affiche pas sur une dépense née de la ventilation", () => {
    // ⚠️ Le cœur de la règle. Détacher une dépense `kind='bank'` ne libère rien :
    // elle *est* la ventilation. Le geste produirait d'un coup une dépense que
    // plus rien ne justifie et une sortie redevenue partiellement ventilée —
    // deux écarts pour le même argent, exactement ce que le module supprime.
    render(<DetachFromTransactionButton expenseId="exp-1" kind="bank" transactionId="txn-9" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
