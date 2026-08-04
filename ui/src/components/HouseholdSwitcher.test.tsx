import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Household } from '@/lib/api/households';
import HouseholdSwitcher from './HouseholdSwitcher';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const state = vi.hoisted(() => ({ households: [] as Household[], activeId: '' }));
const post = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })));

vi.mock('@/lib/axios', () => ({ api: { post } }));
vi.mock('@/lib/modules', () => ({
  useHouseholdList: () => ({
    households: state.households,
    active: state.households.find((h) => h.id === state.activeId),
    isLoading: false,
  }),
}));
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    useMutation: ({ mutationFn }: { mutationFn: (id: string) => unknown }) => ({
      mutate: mutationFn,
      isPending: false,
    }),
  };
});

function householdNamed(id: string, name: string): Household {
  return { id, name } as Household;
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  state.households = [];
  state.activeId = '';
  post.mockClear();
});

describe('HouseholdSwitcher — le titre du header', () => {
  it('nomme le foyer actif, pas l’application', () => {
    state.households = [householdNamed('h1', 'Maison des Vandamme')];
    state.activeId = 'h1';

    render(<HouseholdSwitcher />);

    expect(screen.getByTestId('topbar-household')).toHaveTextContent('Maison des Vandamme');
  });

  // Un menu à une seule entrée promet un choix qui n'existe pas.
  it("n'ouvre pas de menu quand l'utilisateur n'a qu'un foyer", () => {
    state.households = [householdNamed('h1', 'Maison des Vandamme')];
    state.activeId = 'h1';

    render(<HouseholdSwitcher />);

    expect(screen.getByTestId('topbar-household').tagName).toBe('SPAN');
  });

  it('bascule de foyer depuis le header quand il y en a plusieurs', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    state.households = [householdNamed('h1', 'Maison des Vandamme'), householdNamed('h2', 'Appartement Lille')];
    state.activeId = 'h1';

    render(<HouseholdSwitcher />);
    await user.click(screen.getByTestId('topbar-household'));
    await user.click(screen.getByRole('menuitem', { name: /Appartement Lille/ }));

    expect(post).toHaveBeenCalledWith('/households/switch/', { household_id: 'h2' });
  });

  it('ne rebascule pas sur le foyer déjà actif', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    state.households = [householdNamed('h1', 'Maison des Vandamme'), householdNamed('h2', 'Appartement Lille')];
    state.activeId = 'h1';

    render(<HouseholdSwitcher />);
    await user.click(screen.getByTestId('topbar-household'));
    await user.click(screen.getByRole('menuitem', { name: /Maison des Vandamme/ }));

    expect(post).not.toHaveBeenCalled();
  });

  it("n'affiche rien tant que le foyer actif est inconnu", () => {
    render(<HouseholdSwitcher />);

    expect(screen.queryByTestId('topbar-household')).not.toBeInTheDocument();
  });
});
