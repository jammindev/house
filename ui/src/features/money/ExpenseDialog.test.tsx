import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExpenseDialog from './ExpenseDialog';

/**
 * Une seule porte de saisie, et le moyen de paiement décide ce qu'on écrit.
 *
 * Il y avait deux boutons « Dépense » qui n'écrivaient pas la même chose : celui du
 * dashboard créait une `Interaction` nue, celui de l'onglet Dépenses forçait un
 * **compte espèces**. Une dépense par carte n'avait donc aucun chemin juste — la
 * passer par l'onglet Dépenses la comptait en liquide et faussait le solde des
 * espèces, jusqu'à déclencher « espèces à découvert », un écart non arbitrable.
 *
 * Ce que ces tests tiennent :
 *
 * 1. **⚠️ Payer par carte n'écrit AUCUNE ligne bancaire.** C'est l'invariant le plus
 *    coûteux du lot : une ligne manuelle porte un `dedup_hash` en `manual:{uuid4}`,
 *    qui par construction ne peut jamais coïncider avec une ligne importée. Le
 *    relevé ajouterait donc une seconde ligne pour la même dépense, et l'argent
 *    serait compté deux fois — sans un mot.
 * 2. **Payer en espèces écrit bien l'opération de compte**, comportement d'avant
 *    conservé : rien n'est jamais importé sur un compte espèces, donc la ligne
 *    saisie *est* la vérité et l'orphelin disparaît par construction.
 * 3. **On ne demande jamais *quel* compte bancaire.** La fenêtre de conformité est
 *    calculée à l'échelle du foyer, précisément parce que deviner quel compte a
 *    payé est le fait qui manque. Collecter cette information n'aurait aucun
 *    consommateur — et un champ obligatoire sans consommateur est du travail
 *    inventé.
 * 4. **Depuis la fiche d'un compte espèces, la question ne se pose pas** : elle est
 *    déjà répondue par le contexte.
 */

// jsdom n'implémente pas matchMedia, utilisé par useIsMobile (SheetDialog).
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' },
  }),
}));

const recordCashExpense = vi.fn().mockResolvedValue({});
const createManualExpense = vi.fn().mockResolvedValue({});
const createBankAccount = vi.fn().mockResolvedValue({ id: 'cash-created' });

let accounts: Array<Record<string, unknown>> = [];

vi.mock('@/features/banking/hooks', () => ({
  useBankAccounts: () => ({ data: accounts }),
  useRecordCashExpense: () => ({ mutateAsync: recordCashExpense, isPending: false }),
  useCreateBankAccount: () => ({ mutateAsync: createBankAccount, isPending: false }),
}));

vi.mock('@/features/expenses/hooks', () => ({
  useCreateManualExpense: () => ({ mutateAsync: createManualExpense, isPending: false }),
}));

/** Le form partagé, réduit à ce qu'on veut vérifier : le montant qu'il remonte. */
vi.mock('@/features/interactions/PurchaseForm', () => ({
  default: ({ onSubmit }: { onSubmit: (p: Record<string, unknown>) => void }) => (
    <button type="button" onClick={() => onSubmit({ amount: 42, occurred_at: '2026-03-10T12:00:00Z' })}>
      submit
    </button>
  ),
}));

const CASH = { id: 'cash-1', name: 'Espèces', kind: 'cash', archived: false };
const BANK = { id: 'bank-1', name: 'Courant', kind: 'bank', archived: false };

function open(props: Partial<React.ComponentProps<typeof ExpenseDialog>> = {}) {
  return render(<ExpenseDialog open onOpenChange={() => {}} {...props} />);
}

async function fillLabel(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/money\.expense\.new\.label/), 'Restaurant');
}

describe('ExpenseDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accounts = [CASH, BANK];
  });

  it('paying by card writes no bank line at all', async () => {
    const user = userEvent.setup();
    open();
    await fillLabel(user);

    // « Carte, virement ou prélèvement » est le défaut : c'est le cas dominant, et
    // c'est aussi le seul qui n'invente pas de ligne.
    await user.click(screen.getByText('submit'));

    await waitFor(() => expect(createManualExpense).toHaveBeenCalledTimes(1));
    expect(recordCashExpense).not.toHaveBeenCalled();
    expect(createManualExpense.mock.calls[0][0]).toMatchObject({ subject: 'Restaurant' });
  });

  it('never asks which bank account paid', () => {
    open();
    expect(screen.queryByText(BANK.name)).toBeNull();
  });

  it('paying cash records the account operation', async () => {
    const user = userEvent.setup();
    open();
    await fillLabel(user);
    await user.selectOptions(
      screen.getByLabelText(/money\.expense\.new\.paidWith/),
      'cash',
    );
    await user.click(screen.getByText('submit'));

    await waitFor(() => expect(recordCashExpense).toHaveBeenCalledTimes(1));
    expect(createManualExpense).not.toHaveBeenCalled();
    expect(recordCashExpense.mock.calls[0][0]).toMatchObject({
      account: CASH.id,
      label: 'Restaurant',
      amount: '42.00',
    });
  });

  it('offers to create the cash account rather than sending the user away', async () => {
    const user = userEvent.setup();
    accounts = [BANK];
    open();
    await user.selectOptions(
      screen.getByLabelText(/money\.expense\.new\.paidWith/),
      'cash',
    );

    expect(screen.getByText('banking.cash.noAccount')).toBeTruthy();
    await user.click(screen.getByText('banking.cash.createAccount'));
    await waitFor(() => expect(createBankAccount).toHaveBeenCalledTimes(1));
    expect(createBankAccount.mock.calls[0][0]).toMatchObject({ kind: 'cash' });
  });

  it('does not ask how it was paid when opened on a cash account', async () => {
    const user = userEvent.setup();
    open({ cashAccount: CASH as never });

    expect(screen.queryByLabelText(/money\.expense\.new\.paidWith/)).toBeNull();

    await fillLabel(user);
    await user.click(screen.getByText('submit'));
    await waitFor(() => expect(recordCashExpense).toHaveBeenCalledTimes(1));
    expect(recordCashExpense.mock.calls[0][0]).toMatchObject({ account: CASH.id });
  });
});
