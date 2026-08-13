import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Household } from '@/lib/api/households';
import HouseholdSwitcher from './HouseholdSwitcher';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const state = vi.hoisted(() => ({
  households: [] as Household[],
  activeId: '',
  isMobile: false,
}));
const post = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })));

vi.mock('@/lib/axios', () => ({ api: { post } }));
vi.mock('@/lib/hooks/useIsMobile', () => ({ useIsMobile: () => state.isMobile }));
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
  state.isMobile = false;
  post.mockClear();
});

describe('HouseholdSwitcher — le titre du header', () => {
  it('nomme le foyer actif, pas l’application', () => {
    state.households = [householdNamed('h1', 'Maison des Vandamme')];
    state.activeId = 'h1';

    render(<HouseholdSwitcher placement="topbar" />);

    expect(screen.getByTestId('topbar-household')).toHaveTextContent('Maison des Vandamme');
  });

  // Un menu à une seule entrée promet un choix qui n'existe pas.
  it("n'ouvre pas de menu quand l'utilisateur n'a qu'un foyer", () => {
    state.households = [householdNamed('h1', 'Maison des Vandamme')];
    state.activeId = 'h1';

    render(<HouseholdSwitcher placement="topbar" />);

    expect(screen.getByTestId('topbar-household').tagName).toBe('SPAN');
  });

  it('bascule de foyer depuis le header quand il y en a plusieurs', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    state.households = [householdNamed('h1', 'Maison des Vandamme'), householdNamed('h2', 'Appartement Lille')];
    state.activeId = 'h1';

    render(<HouseholdSwitcher placement="topbar" />);
    await user.click(screen.getByTestId('topbar-household'));
    await user.click(screen.getByRole('menuitem', { name: /Appartement Lille/ }));

    expect(post).toHaveBeenCalledWith('/households/switch/', { household_id: 'h2' });
  });

  it('ne rebascule pas sur le foyer déjà actif', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    state.households = [householdNamed('h1', 'Maison des Vandamme'), householdNamed('h2', 'Appartement Lille')];
    state.activeId = 'h1';

    render(<HouseholdSwitcher placement="topbar" />);
    await user.click(screen.getByTestId('topbar-household'));
    await user.click(screen.getByRole('menuitem', { name: /Maison des Vandamme/ }));

    expect(post).not.toHaveBeenCalled();
  });

  it("n'affiche rien tant que le foyer actif est inconnu", () => {
    render(<HouseholdSwitcher placement="topbar" />);

    expect(screen.queryByTestId('topbar-household')).not.toBeInTheDocument();
  });
});

/**
 * Régression #577. Le header mobile porte déjà cinq actions à droite (météo,
 * recherche, cloche, avatar, déconnexion) ; le nom du foyer, posé dans un
 * `flex-1` à toutes les largeurs, les rognait. Il déménage donc dans la
 * sidebar sous 768 px — là où il est lisible en entier, et où le sélecteur
 * reste atteignable pour un utilisateur multi-foyers.
 *
 * Ce qui est tenu ici, ce n'est pas une classe CSS : c'est qu'il n'y ait
 * **jamais deux endroits** qui nomment le foyer en même temps. Masquer par CSS
 * laisserait les deux instances dans le DOM — donc deux `data-testid`
 * identiques, et un `getByTestId` en mode strict qui casse au premier E2E.
 */
describe('HouseholdSwitcher — le nom du foyer n’a qu’un domicile à la fois', () => {
  beforeEach(() => {
    state.households = [householdNamed('h1', 'Maison des Vandamme')];
    state.activeId = 'h1';
  });

  it('sur mobile, se tait dans le header', () => {
    state.isMobile = true;

    render(<HouseholdSwitcher placement="topbar" />);

    expect(screen.queryByTestId('topbar-household')).not.toBeInTheDocument();
  });

  it('sur mobile, se dit dans la sidebar', () => {
    state.isMobile = true;

    render(<HouseholdSwitcher placement="sidebar" />);

    expect(screen.getByTestId('topbar-household')).toHaveTextContent('Maison des Vandamme');
  });

  it('sur desktop, se dit dans le header', () => {
    render(<HouseholdSwitcher placement="topbar" />);

    expect(screen.getByTestId('topbar-household')).toHaveTextContent('Maison des Vandamme');
  });

  // Sinon le nom apparaîtrait deux fois sur un écran large, où la sidebar est
  // statique et le header déjà là.
  it('sur desktop, se tait dans la sidebar', () => {
    render(<HouseholdSwitcher placement="sidebar" />);

    expect(screen.queryByTestId('topbar-household')).not.toBeInTheDocument();
  });

  // Un utilisateur multi-foyers doit pouvoir basculer sans écran large.
  it('reste un sélecteur dans la sidebar quand il y a plusieurs foyers', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    state.isMobile = true;
    state.households = [householdNamed('h1', 'Maison des Vandamme'), householdNamed('h2', 'Appartement Lille')];

    render(<HouseholdSwitcher placement="sidebar" />);
    await user.click(screen.getByTestId('topbar-household'));
    await user.click(screen.getByRole('menuitem', { name: /Appartement Lille/ }));

    expect(post).toHaveBeenCalledWith('/households/switch/', { household_id: 'h2' });
  });
});
