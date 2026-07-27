import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LinkedLineActions from './LinkedLineActions';
import { interactionKeys } from '@/features/interactions/hooks';

const unlink = vi.fn();
const deleteExpense = vi.fn().mockResolvedValue(undefined);

vi.mock('./hooks', () => ({
  useUnlinkAllocation: () => ({ mutate: unlink, isPending: false }),
}));

vi.mock('@/features/interactions/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/features/interactions/hooks')>(
    '@/features/interactions/hooks',
  );
  return { ...actual, useDeleteInteraction: () => ({ mutateAsync: deleteExpense }) };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderActions(kind: string | undefined, onDeleted?: () => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(interactionKeys.list({ type: 'expense' }), {
    items: [{ id: 'exp-1' }, { id: 'exp-2' }],
    count: 2,
  });
  const utils = render(
    <QueryClientProvider client={qc}>
      <LinkedLineActions
        expenseId="exp-1"
        kind={kind}
        transactionId="txn-9"
        onDeleted={onDeleted}
      />
    </QueryClientProvider>,
  );
  return { ...utils, qc };
}

describe('LinkedLineActions', () => {
  beforeEach(() => {
    vi.useRealTimers();
    unlink.mockClear();
    deleteExpense.mockClear();
  });

  it('détache une dépense rapprochée après coup, sans la supprimer', async () => {
    const user = userEvent.setup();
    renderActions('manual');

    await user.click(screen.getByRole('button'));

    expect(unlink).toHaveBeenCalledWith({ transactionId: 'txn-9', interactionId: 'exp-1' });
    expect(deleteExpense).not.toHaveBeenCalled();
  });

  it.each(['project_purchase', 'recurring', 'stock_purchase', undefined])(
    'détache, quel que soit le kind rapproché après coup (%s)',
    (kind) => {
      renderActions(kind);
      expect(screen.getByRole('button')).toHaveTextContent('banking.attach.detach');
    },
  );

  it('supprime une dépense née de la ventilation, et jamais la ligne', async () => {
    // Le geste demandé en recette : une ligne transformée en dépense se défait en
    // supprimant la dépense. La ligne bancaire n'est pas touchée — elle redevient
    // simplement à ranger. La détacher, elle, laisserait une dépense que plus rien
    // ne justifie **et** une sortie incomplète : deux écarts pour le même argent.
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const { qc } = renderActions('bank', onDeleted);

    await user.click(screen.getByRole('button'));

    expect(unlink).not.toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalled();

    // Retrait optimiste immédiat, appel API différé le temps du « Annuler ».
    const cached = qc.getQueryData(interactionKeys.list({ type: 'expense' })) as {
      items: { id: string }[];
      count: number;
    };
    expect(cached.items.map((i) => i.id)).toEqual(['exp-2']);
    expect(cached.count).toBe(1);

    await waitFor(() => expect(deleteExpense).toHaveBeenCalledWith('exp-1'), { timeout: 8000 });
  }, 10000);

  it('offre un geste quel que soit le kind', () => {
    // La régression trouvée en recette : la première version ne proposait rien sur
    // une dépense issue d'un relevé, c'est-à-dire sur la quasi-totalité des
    // dépenses d'un foyer qui importe ses relevés. Un badge sans geste envoie
    // chercher ailleurs ce qu'on croit absent.
    for (const kind of ['bank', 'manual', 'recurring', 'project_purchase']) {
      const { unmount } = renderActions(kind);
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    }
  });
});
